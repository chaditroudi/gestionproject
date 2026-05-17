import { pool } from "../db/pool.js";
import {
  canAccessTask,
  canManageTask,
  getTaskAccessContext
} from "../utils/access.js";

const allowedStatuses = ["todo", "in_progress", "done", "blocked"];
const allowedPriorities = ["low", "medium", "high"];

const baseTaskQuery = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.created_at,
    t.updated_at,
    t.parent_task_id,
    t.team_id,
    team.name AS team_name,
    t.assignee_id,
    assignee.full_name AS assignee_name,
    t.creator_id,
    creator.full_name AS creator_name,
    (
      SELECT COUNT(*)
      FROM task_comments comment
      WHERE comment.task_id = t.id
    )::int AS comment_count,
    (
      SELECT COUNT(*)
      FROM task_checklist_items item
      WHERE item.task_id = t.id
    )::int AS checklist_count,
    (
      SELECT COUNT(*)
      FROM task_checklist_items item
      WHERE item.task_id = t.id AND item.is_completed = TRUE
    )::int AS checklist_completed_count,
    (
      SELECT COUNT(*)
      FROM task_attachments attachment
      WHERE attachment.task_id = t.id
    )::int AS attachment_count,
    (
      SELECT COUNT(*)
      FROM tasks subtask
      WHERE subtask.parent_task_id = t.id
    )::int AS subtask_count,
    CASE
      WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status <> 'done' THEN TRUE
      ELSE FALSE
    END AS is_overdue
  FROM tasks t
  LEFT JOIN teams team ON team.id = t.team_id
  LEFT JOIN users assignee ON assignee.id = t.assignee_id
  LEFT JOIN users creator ON creator.id = t.creator_id
`;

function validateTaskPayload({ status, priority }) {
  if (status && !allowedStatuses.includes(status)) {
    return "Statut de tache invalide.";
  }

  if (priority && !allowedPriorities.includes(priority)) {
    return "Priorite de tache invalide.";
  }

  return null;
}

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function createActivityLog(client, taskId, actorId, actionType, message, metadata = {}) {
  await client.query(
    `
      INSERT INTO task_activity_logs (task_id, actor_id, action_type, message, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [taskId, actorId, actionType, message, JSON.stringify(metadata)]
  );
}

async function resolveMentions(client, content) {
  const tokens = [...new Set((content.match(/@([a-zA-Z0-9._-]+)/g) || []).map((token) => token.slice(1).toLowerCase()))];

  if (!tokens.length) {
    return [];
  }

  const usersResult = await client.query(`
    SELECT id, full_name, email
    FROM users
  `);

  return usersResult.rows.filter((user) => {
    const normalizedFullName = user.full_name.replace(/\s+/g, "").toLowerCase();
    const emailHandle = user.email.split("@")[0].toLowerCase();
    return tokens.includes(normalizedFullName) || tokens.includes(emailHandle);
  });
}

async function fetchTaskComments(taskId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.task_id,
        c.content,
        c.created_at,
        c.updated_at,
        c.author_id,
        author.full_name AS author_name,
        author.email AS author_email,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', mentioned.id,
              'fullName', mentioned.full_name,
              'email', mentioned.email
            )
          ) FILTER (WHERE mentioned.id IS NOT NULL),
          '[]'
        ) AS mentions
      FROM task_comments c
      LEFT JOIN users author ON author.id = c.author_id
      LEFT JOIN task_comment_mentions mention ON mention.comment_id = c.id
      LEFT JOIN users mentioned ON mentioned.id = mention.user_id
      WHERE c.task_id = $1
      GROUP BY c.id, author.full_name, author.email
      ORDER BY c.created_at ASC
    `,
    [taskId]
  );

  return result.rows;
}

async function fetchTaskChecklist(taskId) {
  const result = await pool.query(
    `
      SELECT
        item.id,
        item.task_id,
        item.title,
        item.is_completed,
        item.completed_at,
        item.completed_by,
        completed_user.full_name AS completed_by_name,
        item.created_by,
        created_user.full_name AS created_by_name,
        item.created_at,
        item.updated_at
      FROM task_checklist_items item
      LEFT JOIN users completed_user ON completed_user.id = item.completed_by
      LEFT JOIN users created_user ON created_user.id = item.created_by
      WHERE item.task_id = $1
      ORDER BY item.created_at ASC
    `,
    [taskId]
  );

  return result.rows;
}

async function fetchTaskAttachments(taskId) {
  const result = await pool.query(
    `
      SELECT
        attachment.id,
        attachment.task_id,
        attachment.label,
        attachment.url,
        attachment.uploaded_by,
        uploader.full_name AS uploaded_by_name,
        attachment.created_at
      FROM task_attachments attachment
      LEFT JOIN users uploader ON uploader.id = attachment.uploaded_by
      WHERE attachment.task_id = $1
      ORDER BY attachment.created_at DESC
    `,
    [taskId]
  );

  return result.rows;
}

async function fetchTaskActivity(taskId) {
  const result = await pool.query(
    `
      SELECT
        log.id,
        log.task_id,
        log.action_type,
        log.message,
        log.metadata,
        log.created_at,
        log.actor_id,
        actor.full_name AS actor_name
      FROM task_activity_logs log
      LEFT JOIN users actor ON actor.id = log.actor_id
      WHERE log.task_id = $1
      ORDER BY log.created_at DESC
      LIMIT 20
    `,
    [taskId]
  );

  return result.rows;
}

async function fetchSubtasks(taskId) {
  const result = await pool.query(
    `${baseTaskQuery} WHERE t.parent_task_id = $1 ORDER BY t.created_at ASC`,
    [taskId]
  );

  return result.rows;
}

async function fetchTaskById(taskId) {
  const result = await pool.query(`${baseTaskQuery} WHERE t.id = $1`, [taskId]);
  return result.rows[0] || null;
}

async function fetchTaskDetail(taskId) {
  const task = await fetchTaskById(taskId);

  if (!task) {
    return null;
  }

  const [comments, checklist, attachments, activity, subtasks] = await Promise.all([
    fetchTaskComments(taskId),
    fetchTaskChecklist(taskId),
    fetchTaskAttachments(taskId),
    fetchTaskActivity(taskId),
    fetchSubtasks(taskId)
  ]);

  return {
    ...task,
    comments,
    checklist,
    attachments,
    activity,
    subtasks
  };
}

async function ensureTaskAccess(req, res, taskId) {
  const hasAccess = await canAccessTask(pool, req.user, taskId);

  if (!hasAccess) {
    res.status(403).json({ message: "Vous ne pouvez pas acceder a cette tache." });
    return false;
  }

  return true;
}

export async function getTasks(req, res, next) {
  try {
    const { accessibleTeamIds } = await getTaskAccessContext(pool, req.user);
    const params = [];
    const conditions = ["t.parent_task_id IS NULL"];

    if (["admin", "director"].includes(req.user.role)) {
      // Full access.
    } else if (req.user.role === "hr") {
      return res.json([]);
    } else if (accessibleTeamIds?.length) {
      params.push(req.user.id, accessibleTeamIds);
      conditions.push(
        `(t.assignee_id = $1 OR t.creator_id = $1 OR t.team_id = ANY($2::int[]))`
      );
    } else {
      params.push(req.user.id);
      conditions.push(`(t.assignee_id = $1 OR t.creator_id = $1)`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const result = await pool.query(
      `${baseTaskQuery} ${whereClause} ORDER BY t.created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

export async function getTaskById(req, res, next) {
  try {
    const taskId = Number(req.params.id);

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const task = await fetchTaskDetail(taskId);

    if (!task) {
      return res.status(404).json({ message: "Tache introuvable." });
    }

    return res.json(task);
  } catch (error) {
    return next(error);
  }
}

export async function createTask(req, res, next) {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      teamId,
      assigneeId,
      parentTaskId
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Le titre de la tache est obligatoire." });
    }

    const validationError = validateTaskPayload({ status, priority });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { accessibleTeamIds, managedTeamIds } = await getTaskAccessContext(pool, req.user);

    if (req.user.role === "manager" && teamId && !managedTeamIds.includes(Number(teamId))) {
      return res.status(403).json({ message: "Vous ne pouvez creer des taches que pour vos equipes." });
    }

    if (
      req.user.role === "team_lead" &&
      teamId &&
      !accessibleTeamIds?.includes(Number(teamId))
    ) {
      return res.status(403).json({ message: "Vous ne pouvez creer des taches que pour vos equipes." });
    }

    if (parentTaskId && !(await canAccessTask(pool, req.user, Number(parentTaskId)))) {
      return res.status(403).json({ message: "Vous ne pouvez pas rattacher cette sous-tache." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
          INSERT INTO tasks (
            title,
            description,
            status,
            priority,
            due_date,
            parent_task_id,
            team_id,
            assignee_id,
            creator_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `,
        [
          title,
          description || null,
          status || "todo",
          priority || "medium",
          dueDate || null,
          parentTaskId || null,
          teamId || null,
          assigneeId || null,
          req.user.id
        ]
      );

      await createActivityLog(
        client,
        result.rows[0].id,
        req.user.id,
        parentTaskId ? "subtask_created" : "task_created",
        parentTaskId ? "Une sous-tache a ete creee." : "Une nouvelle tache a ete creee.",
        {
          status: status || "todo",
          priority: priority || "medium",
          parentTaskId: parentTaskId || null
        }
      );

      await client.query("COMMIT");

      const taskResult = await fetchTaskDetail(result.rows[0].id);
      return res.status(201).json(taskResult);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function updateTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      teamId,
      assigneeId,
      parentTaskId
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Le titre de la tache est obligatoire." });
    }

    const validationError = validateTaskPayload({ status, priority });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingTask = await pool.query(
      `
        SELECT id, team_id, creator_id, assignee_id, status, priority, title
        FROM tasks
        WHERE id = $1
      `,
      [taskId]
    );

    const task = existingTask.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Tache introuvable." });
    }

    if (!(await canManageTask(pool, req.user, task))) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier cette tache." });
    }

    if (parentTaskId && parentTaskId === taskId) {
      return res.status(400).json({ message: "Une tache ne peut pas etre sa propre sous-tache." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          UPDATE tasks
          SET title = $1,
              description = $2,
              status = $3,
              priority = $4,
              due_date = $5,
              parent_task_id = $6,
              team_id = $7,
              assignee_id = $8,
              updated_at = NOW()
          WHERE id = $9
        `,
        [
          title,
          description || null,
          status,
          priority,
          dueDate || null,
          parentTaskId || null,
          teamId || null,
          assigneeId || null,
          taskId
        ]
      );

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "task_updated",
        "Les informations principales de la tache ont ete mises a jour.",
        {
          previousStatus: task.status,
          nextStatus: status,
          previousPriority: task.priority,
          nextPriority: priority
        }
      );

      await client.query("COMMIT");

      const taskResult = await fetchTaskDetail(taskId);
      return res.json(taskResult);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function updateTaskStatus(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Statut de tache invalide." });
    }

    const taskResult = await pool.query(
      `
        SELECT id, team_id, creator_id, assignee_id, status
        FROM tasks
        WHERE id = $1
      `,
      [taskId]
    );

    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Tache introuvable." });
    }

    if (req.user.role === "employee") {
      if (task.assignee_id !== req.user.id) {
        return res.status(403).json({
          message: "Vous pouvez uniquement mettre a jour vos taches assignees."
        });
      }
    } else if (!["admin", "director"].includes(req.user.role)) {
      if (!(await canManageTask(pool, req.user, task)) && task.assignee_id !== req.user.id) {
        return res.status(403).json({
          message: "Vous ne pouvez pas mettre a jour cette tache."
        });
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          UPDATE tasks
          SET status = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [status, taskId]
      );

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "status_changed",
        `Le statut de la tache est passe de ${task.status} a ${status}.`,
        {
          previousStatus: task.status,
          nextStatus: status
        }
      );

      await client.query("COMMIT");

      const updatedTask = await fetchTaskDetail(taskId);
      return res.json(updatedTask);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const taskResult = await pool.query(
      `
        SELECT id, team_id, creator_id
        FROM tasks
        WHERE id = $1
      `,
      [taskId]
    );
    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Tache introuvable." });
    }

    if (!(await canManageTask(pool, req.user, task))) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer cette tache." });
    }

    const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [taskId]);

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Tache introuvable." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function addTaskComment(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ message: "Le contenu du commentaire est obligatoire." });
    }

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const commentResult = await client.query(
        `
          INSERT INTO task_comments (task_id, author_id, content)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [taskId, req.user.id, content.trim()]
      );

      const commentId = commentResult.rows[0].id;
      const mentionedUsers = await resolveMentions(client, content);

      for (const user of mentionedUsers) {
        await client.query(
          `
            INSERT INTO task_comment_mentions (comment_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [commentId, user.id]
        );
      }

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "comment_added",
        "Un commentaire a ete ajoute a la tache.",
        {
          commentId,
          mentions: mentionedUsers.map((user) => user.id)
        }
      );

      await client.query("COMMIT");

      const comments = await fetchTaskComments(taskId);
      return res.status(201).json(comments.find((comment) => comment.id === commentId));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function addTaskChecklistItem(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const { title } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: "Le titre de la checklist est obligatoire." });
    }

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
          INSERT INTO task_checklist_items (task_id, title, created_by)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [taskId, title.trim(), req.user.id]
      );

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "checklist_item_added",
        "Un element a ete ajoute a la checklist.",
        {
          itemId: result.rows[0].id
        }
      );

      await client.query("COMMIT");

      const items = await fetchTaskChecklist(taskId);
      return res.status(201).json(items.find((item) => item.id === result.rows[0].id));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function updateTaskChecklistItem(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { title, isCompleted } = req.body;

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const checklistResult = await client.query(
        `
          SELECT id, title, is_completed
          FROM task_checklist_items
          WHERE id = $1 AND task_id = $2
        `,
        [itemId, taskId]
      );

      const checklistItem = checklistResult.rows[0];

      if (!checklistItem) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Element de checklist introuvable." });
      }

      await client.query(
        `
          UPDATE task_checklist_items
          SET title = $1,
              is_completed = $2,
              completed_by = $3,
              completed_at = $4,
              updated_at = NOW()
          WHERE id = $5
        `,
        [
          title?.trim() || checklistItem.title,
          Boolean(isCompleted),
          isCompleted ? req.user.id : null,
          isCompleted ? new Date() : null,
          itemId
        ]
      );

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "checklist_item_updated",
        isCompleted
          ? "Un element de checklist a ete marque comme complete."
          : "Un element de checklist a ete mis a jour.",
        {
          itemId,
          isCompleted: Boolean(isCompleted)
        }
      );

      await client.query("COMMIT");

      const items = await fetchTaskChecklist(taskId);
      return res.json(items.find((item) => item.id === itemId));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function deleteTaskChecklistItem(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
          DELETE FROM task_checklist_items
          WHERE id = $1 AND task_id = $2
          RETURNING id
        `,
        [itemId, taskId]
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Element de checklist introuvable." });
      }

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "checklist_item_deleted",
        "Un element a ete retire de la checklist.",
        {
          itemId
        }
      );

      await client.query("COMMIT");
      return res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function addTaskAttachment(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const { label, url } = req.body;

    if (!label?.trim() || !url?.trim()) {
      return res.status(400).json({ message: "Le libelle et l'URL sont obligatoires." });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({ message: "L'URL de la ressource est invalide." });
    }

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
          INSERT INTO task_attachments (task_id, label, url, uploaded_by)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [taskId, label.trim(), url.trim(), req.user.id]
      );

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "attachment_added",
        "Une ressource a ete ajoutee a la tache.",
        {
          attachmentId: result.rows[0].id
        }
      );

      await client.query("COMMIT");

      const attachments = await fetchTaskAttachments(taskId);
      return res.status(201).json(
        attachments.find((attachment) => attachment.id === result.rows[0].id)
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function deleteTaskAttachment(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);

    if (!(await ensureTaskAccess(req, res, taskId))) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
          DELETE FROM task_attachments
          WHERE id = $1 AND task_id = $2
          RETURNING id
        `,
        [attachmentId, taskId]
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Ressource introuvable." });
      }

      await createActivityLog(
        client,
        taskId,
        req.user.id,
        "attachment_deleted",
        "Une ressource a ete retiree de la tache.",
        {
          attachmentId
        }
      );

      await client.query("COMMIT");
      return res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
}
