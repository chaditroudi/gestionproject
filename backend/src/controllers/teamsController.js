import { pool } from "../db/pool.js";
import { getAccessibleTeamIds, canManageTeam } from "../utils/access.js";

async function fetchTeams(viewer) {
  const accessibleTeamIds = await getAccessibleTeamIds(pool, viewer);
  const params = [];
  let whereClause = "";

  if (accessibleTeamIds?.length === 0) {
    return [];
  }

  if (accessibleTeamIds) {
    params.push(accessibleTeamIds);
    whereClause = `WHERE t.id = ANY($${params.length}::int[])`;
  }

  const result = await pool.query(`
    SELECT
      t.id,
      t.name,
      t.description,
      t.created_at,
      t.manager_id,
      m.full_name AS manager_name,
      COALESCE((
        SELECT json_agg(
          jsonb_build_object(
            'id', u.id,
            'fullName', u.full_name,
            'email', u.email,
            'role', u.role
          )
          ORDER BY u.full_name
        )
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = t.id
      ), '[]') AS members,
      COALESCE((
        SELECT COUNT(*)
        FROM team_members tm
        WHERE tm.team_id = t.id
      ), 0)::int AS member_count,
      COALESCE((
        SELECT COUNT(*)
        FROM tasks task
        WHERE task.team_id = t.id
      ), 0)::int AS total_tasks,
      COALESCE((
        SELECT COUNT(*)
        FROM tasks task
        WHERE task.team_id = t.id AND task.status = 'done'
      ), 0)::int AS completed_tasks,
      COALESCE((
        SELECT COUNT(*)
        FROM tasks task
        WHERE task.team_id = t.id AND task.status <> 'done'
      ), 0)::int AS open_tasks
    FROM teams t
    LEFT JOIN users m ON m.id = t.manager_id
    ${whereClause}
    ORDER BY t.created_at DESC
  `, params);

  return result.rows;
}

export async function getTeams(req, res, next) {
  try {
    const teams = await fetchTeams(req.user);
    return res.json(teams);
  } catch (error) {
    return next(error);
  }
}

export async function createTeam(req, res, next) {
  const client = await pool.connect();

  try {
    const { name, description, managerId, memberIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Le nom de l'equipe est obligatoire." });
    }

    if (req.user.role === "manager" && managerId && Number(managerId) !== req.user.id) {
      return res.status(403).json({
        message: "Un manager ne peut creer qu'une equipe dont il est responsable."
      });
    }

    await client.query("BEGIN");

    const teamResult = await client.query(
      `
        INSERT INTO teams (name, description, manager_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [name, description || null, managerId || null]
    );

    const teamId = teamResult.rows[0].id;
    const uniqueMemberIds = [...new Set([...(memberIds || []), managerId].filter(Boolean))];

    for (const memberId of uniqueMemberIds) {
      await client.query(
        `
          INSERT INTO team_members (team_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [teamId, memberId]
      );
    }

    await client.query("COMMIT");

    const teams = await fetchTeams(req.user);
    const created = teams.find((team) => team.id === teamId);
    return res.status(201).json(created);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({ message: "Cette equipe existe deja." });
    }

    return next(error);
  } finally {
    client.release();
  }
}

export async function updateTeam(req, res, next) {
  const client = await pool.connect();

  try {
    const teamId = Number(req.params.id);
    const { name, description, managerId, memberIds = [] } = req.body;

    if (!(await canManageTeam(client, req.user, teamId)) && !["admin", "director"].includes(req.user.role)) {
      return res.status(403).json({ message: "Vous ne pouvez pas gerer cette equipe." });
    }

    await client.query("BEGIN");

    const updateResult = await client.query(
      `
        UPDATE teams
        SET name = $1,
            description = $2,
            manager_id = $3
        WHERE id = $4
        RETURNING id
      `,
      [name, description || null, managerId || null, teamId]
    );

    if (!updateResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Equipe introuvable." });
    }

    await client.query("DELETE FROM team_members WHERE team_id = $1", [teamId]);

    const uniqueMemberIds = [...new Set([...(memberIds || []), managerId].filter(Boolean))];

    for (const memberId of uniqueMemberIds) {
      await client.query(
        `
          INSERT INTO team_members (team_id, user_id)
          VALUES ($1, $2)
        `,
        [teamId, memberId]
      );
    }

    await client.query("COMMIT");

    const teams = await fetchTeams(req.user);
    const updated = teams.find((team) => team.id === teamId);
    return res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
}

export async function deleteTeam(req, res, next) {
  try {
    const teamId = Number(req.params.id);

    if (!(await canManageTeam(pool, req.user, teamId)) && !["admin", "director"].includes(req.user.role)) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer cette equipe." });
    }

    const result = await pool.query("DELETE FROM teams WHERE id = $1 RETURNING id", [teamId]);

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Equipe introuvable." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
