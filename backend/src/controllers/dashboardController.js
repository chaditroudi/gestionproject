import { pool } from "../db/pool.js";
import { getAccessibleTeamIds } from "../utils/access.js";

function buildTaskScope(user, accessibleTeamIds) {
  if (["admin", "director"].includes(user.role)) {
    return { clause: "", params: [] };
  }

  if (user.role === "hr") {
    return { clause: "", params: [] };
  }

  if (accessibleTeamIds?.length) {
    return {
      clause: "WHERE (t.assignee_id = $1 OR t.creator_id = $1 OR t.team_id = ANY($2::int[]))",
      params: [user.id, accessibleTeamIds]
    };
  }

  return {
    clause: "WHERE (t.assignee_id = $1 OR t.creator_id = $1)",
    params: [user.id]
  };
}

function buildUserScope(user, accessibleTeamIds) {
  if (["admin", "director", "hr"].includes(user.role)) {
    return { clause: "", params: [] };
  }

  if (accessibleTeamIds?.length) {
    return {
      clause: `WHERE (
        users.id = $1
        OR EXISTS (
          SELECT 1
          FROM team_members tm
          WHERE tm.user_id = users.id
            AND tm.team_id = ANY($2::int[])
        )
      )`,
      params: [user.id, accessibleTeamIds]
    };
  }

  return {
    clause: "WHERE users.id = $1",
    params: [user.id]
  };
}

function buildTeamScope(user, accessibleTeamIds) {
  if (["admin", "director", "hr"].includes(user.role)) {
    return { clause: "", params: [] };
  }

  if (accessibleTeamIds?.length) {
    return {
      clause: "WHERE team.id = ANY($1::int[])",
      params: [accessibleTeamIds]
    };
  }

  return {
    clause: "WHERE 1 = 0",
    params: []
  };
}

async function fetchDashboardSummaryData(user) {
  const accessibleTeamIds = await getAccessibleTeamIds(pool, user);
  const taskScope = buildTaskScope(user, accessibleTeamIds);
  const userScope = buildUserScope(user, accessibleTeamIds);
  const teamScope = buildTeamScope(user, accessibleTeamIds);

  const [
    totalUsersResult,
    totalTeamsResult,
    totalTasksResult,
    completedTasksResult,
    inProgressTasksResult,
    blockedTasksResult,
    overdueTasksCountResult,
    totalMembersResult,
    recentTasksResult,
    statusBreakdownResult,
    priorityBreakdownResult,
    teamPerformanceResult,
    roleDistributionResult,
    overdueTasksResult,
    upcomingTasksResult
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS value FROM users ${userScope.clause}`,
      userScope.params
    ),
    pool.query(`SELECT COUNT(*)::int AS value FROM teams team ${teamScope.clause}`, teamScope.params),
    pool.query(`SELECT COUNT(*)::int AS value FROM tasks t ${taskScope.clause}`, taskScope.params),
    pool.query(
      `SELECT COUNT(*)::int AS value FROM tasks t ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.status = 'done'`,
      taskScope.params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS value FROM tasks t ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.status = 'in_progress'`,
      taskScope.params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS value FROM tasks t ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.status = 'blocked'`,
      taskScope.params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS value FROM tasks t ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.due_date < CURRENT_DATE AND t.status <> 'done'`,
      taskScope.params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS value FROM users ${userScope.clause}${userScope.clause ? " AND" : " WHERE"} role = 'employee'`,
      userScope.params
    ),
    pool.query(
      `
        SELECT
          t.id,
          t.title,
          t.status,
          t.priority,
          t.due_date,
          team.name AS team_name,
          assignee.full_name AS assignee_name
        FROM tasks t
        LEFT JOIN teams team ON team.id = t.team_id
        LEFT JOIN users assignee ON assignee.id = t.assignee_id
        ${taskScope.clause}
        ORDER BY t.updated_at DESC
        LIMIT 6
      `,
      taskScope.params
    ),
    pool.query(
      `
        SELECT
          t.status,
          COUNT(*)::int AS total
        FROM tasks t
        ${taskScope.clause}
        GROUP BY t.status
        ORDER BY total DESC
      `,
      taskScope.params
    ),
    pool.query(
      `
        SELECT
          t.priority,
          COUNT(*)::int AS total
        FROM tasks t
        ${taskScope.clause}
        GROUP BY t.priority
        ORDER BY
          CASE t.priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END
      `,
      taskScope.params
    ),
    pool.query(
      `
        SELECT
          team.id,
          team.name,
          manager.full_name AS manager_name,
          COUNT(task.id)::int AS total_tasks,
          COUNT(task.id) FILTER (WHERE task.status = 'done')::int AS completed_tasks,
          COUNT(task.id) FILTER (WHERE task.status = 'in_progress')::int AS in_progress_tasks
        FROM teams team
        LEFT JOIN users manager ON manager.id = team.manager_id
        LEFT JOIN tasks task ON task.team_id = team.id
        ${teamScope.clause}
        GROUP BY team.id, manager.full_name
        ORDER BY total_tasks DESC, team.name ASC
      `,
      teamScope.params
    ),
    pool.query(
      `
        SELECT
          users.role,
          COUNT(*)::int AS total
        FROM users
        ${userScope.clause}
        GROUP BY users.role
        ORDER BY total DESC
      `,
      userScope.params
    ),
    pool.query(
      `
        SELECT
          t.id,
          t.title,
          t.due_date,
          team.name AS team_name,
          assignee.full_name AS assignee_name
        FROM tasks t
        LEFT JOIN teams team ON team.id = t.team_id
        LEFT JOIN users assignee ON assignee.id = t.assignee_id
        ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.due_date < CURRENT_DATE AND t.status <> 'done'
        ORDER BY t.due_date ASC
        LIMIT 5
      `,
      taskScope.params
    ),
    pool.query(
      `
        SELECT
          t.id,
          t.title,
          t.status,
          t.priority,
          t.due_date,
          team.name AS team_name,
          assignee.full_name AS assignee_name
        FROM tasks t
        LEFT JOIN teams team ON team.id = t.team_id
        LEFT JOIN users assignee ON assignee.id = t.assignee_id
        ${taskScope.clause}${taskScope.clause ? " AND" : " WHERE"} t.due_date >= CURRENT_DATE
        ORDER BY t.due_date ASC
        LIMIT 5
      `,
      taskScope.params
    )
  ]);

  const stats = {
    total_users: totalUsersResult.rows[0].value,
    total_teams: totalTeamsResult.rows[0].value,
    total_tasks: totalTasksResult.rows[0].value,
    completed_tasks: completedTasksResult.rows[0].value,
    in_progress_tasks: inProgressTasksResult.rows[0].value,
    blocked_tasks: blockedTasksResult.rows[0].value,
    overdue_tasks: overdueTasksCountResult.rows[0].value,
    total_members: totalMembersResult.rows[0].value
  };
  const completionRate =
    stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0;

  return {
    stats: {
      ...stats,
      completion_rate: completionRate
    },
    recentTasks: recentTasksResult.rows,
    statusBreakdown: statusBreakdownResult.rows,
    priorityBreakdown: priorityBreakdownResult.rows,
    teamPerformance: teamPerformanceResult.rows,
    roleDistribution: roleDistributionResult.rows,
    overdueTasks: overdueTasksResult.rows,
    upcomingTasks: upcomingTasksResult.rows
  };
}

function formatReportDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function escapeCsv(value) {
  const normalizedValue = value == null ? "" : String(value);
  return `"${normalizedValue.replaceAll('"', '""')}"`;
}

function buildCsvReport(user, data) {
  const rows = [
    ["section", "label", "value", "extra_1", "extra_2", "extra_3"],
    ["meta", "generated_at", new Date().toISOString(), "", "", ""],
    ["meta", "viewer_role", user.role, "", "", ""],
    ["meta", "visible_scope", "dashboard_summary", "", "", ""]
  ];

  Object.entries(data.stats).forEach(([label, value]) => {
    rows.push(["stats", label, value, "", "", ""]);
  });

  data.statusBreakdown.forEach((item) => {
    rows.push(["status_breakdown", item.status, item.total, "", "", ""]);
  });

  data.priorityBreakdown.forEach((item) => {
    rows.push(["priority_breakdown", item.priority, item.total, "", "", ""]);
  });

  data.roleDistribution.forEach((item) => {
    rows.push(["role_distribution", item.role, item.total, "", "", ""]);
  });

  data.teamPerformance.forEach((team) => {
    rows.push([
      "team_performance",
      team.name,
      team.total_tasks,
      team.completed_tasks,
      team.in_progress_tasks,
      team.manager_name || ""
    ]);
  });

  data.overdueTasks.forEach((task) => {
    rows.push([
      "overdue_tasks",
      task.title,
      formatReportDate(task.due_date),
      task.team_name || "",
      task.assignee_name || "",
      ""
    ]);
  });

  data.upcomingTasks.forEach((task) => {
    rows.push([
      "upcoming_tasks",
      task.title,
      formatReportDate(task.due_date),
      task.status || "",
      task.priority || "",
      task.assignee_name || ""
    ]);
  });

  data.recentTasks.forEach((task) => {
    rows.push([
      "recent_tasks",
      task.title,
      task.status,
      task.priority,
      formatReportDate(task.due_date),
      task.team_name || ""
    ]);
  });

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export async function getDashboardSummary(req, res, next) {
  try {
    const data = await fetchDashboardSummaryData(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function getDashboardReport(req, res, next) {
  try {
    const format = req.query.format === "json" ? "json" : "csv";
    const data = await fetchDashboardSummaryData(req.user);
    const reportDate = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="rapport-dashboard-${reportDate}.json"`);
      return res.json({
        generatedAt: new Date().toISOString(),
        viewerRole: req.user.role,
        ...data
      });
    }

    const csv = buildCsvReport(req.user, data);
    res.setHeader("Content-Disposition", `attachment; filename="rapport-dashboard-${reportDate}.csv"`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}
