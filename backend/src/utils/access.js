import { hasPermission } from "../constants/permissions.js";

function uniq(values) {
  return [...new Set(values)];
}

export async function getManagedTeamIds(poolOrClient, userId) {
  const result = await poolOrClient.query(
    `
      SELECT id
      FROM teams
      WHERE manager_id = $1
    `,
    [userId]
  );

  return result.rows.map((row) => row.id);
}

export async function getMemberTeamIds(poolOrClient, userId) {
  const result = await poolOrClient.query(
    `
      SELECT team_id
      FROM team_members
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows.map((row) => row.team_id);
}

export async function getAccessibleTeamIds(poolOrClient, user) {
  if (
    hasPermission(user.role, "manage_teams") &&
    ["admin", "director"].includes(user.role)
  ) {
    return null;
  }

  if (user.role === "hr") {
    return null;
  }

  const [managedTeamIds, memberTeamIds] = await Promise.all([
    getManagedTeamIds(poolOrClient, user.id),
    getMemberTeamIds(poolOrClient, user.id)
  ]);

  return uniq([...managedTeamIds, ...memberTeamIds]);
}

export async function canManageTeam(poolOrClient, user, teamId) {
  if (["admin", "director"].includes(user.role)) {
    return true;
  }

  if (user.role !== "manager") {
    return false;
  }

  const result = await poolOrClient.query(
    `
      SELECT id
      FROM teams
      WHERE id = $1 AND manager_id = $2
    `,
    [teamId, user.id]
  );

  return Boolean(result.rows[0]);
}

export async function getTaskAccessContext(poolOrClient, user) {
  const accessibleTeamIds = await getAccessibleTeamIds(poolOrClient, user);
  const managedTeamIds = ["admin", "director"].includes(user.role)
    ? null
    : await getManagedTeamIds(poolOrClient, user.id);

  return {
    accessibleTeamIds,
    managedTeamIds
  };
}

export async function canAccessTask(poolOrClient, user, taskId) {
  if (["admin", "director"].includes(user.role)) {
    return true;
  }

  if (user.role === "hr") {
    return false;
  }

  const { accessibleTeamIds } = await getTaskAccessContext(poolOrClient, user);

  if (accessibleTeamIds?.length) {
    const result = await poolOrClient.query(
      `
        SELECT id
        FROM tasks
        WHERE id = $1
          AND (
            assignee_id = $2
            OR creator_id = $2
            OR team_id = ANY($3::int[])
          )
      `,
      [taskId, user.id, accessibleTeamIds]
    );

    return Boolean(result.rows[0]);
  }

  const result = await poolOrClient.query(
    `
      SELECT id
      FROM tasks
      WHERE id = $1
        AND (
          assignee_id = $2
          OR creator_id = $2
        )
    `,
    [taskId, user.id]
  );

  return Boolean(result.rows[0]);
}

export async function canManageTask(poolOrClient, user, task) {
  if (["admin", "director"].includes(user.role)) {
    return true;
  }

  const { accessibleTeamIds, managedTeamIds } = await getTaskAccessContext(poolOrClient, user);

  if (user.role === "manager") {
    return (
      task.creator_id === user.id ||
      (task.team_id && managedTeamIds.includes(task.team_id))
    );
  }

  if (user.role === "team_lead") {
    return (
      task.creator_id === user.id ||
      (task.team_id && accessibleTeamIds?.includes(task.team_id))
    );
  }

  return false;
}

export function canAssignRole(actorRole, targetRole) {
  if (actorRole === "admin") {
    return true;
  }

  if (actorRole === "hr") {
    return ["employee", "hr", "team_lead", "manager"].includes(targetRole);
  }

  return false;
}
