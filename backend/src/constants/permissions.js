export const permissionsByRole = {
  admin: [
    "view_dashboard",
    "view_users",
    "manage_users",
    "view_teams",
    "manage_teams",
    "view_tasks",
    "manage_tasks"
  ],
  director: [
    "view_dashboard",
    "view_users",
    "view_teams",
    "manage_teams",
    "view_tasks",
    "manage_tasks"
  ],
  manager: [
    "view_dashboard",
    "view_users",
    "view_teams",
    "manage_teams",
    "view_tasks",
    "manage_tasks"
  ],
  team_lead: [
    "view_dashboard",
    "view_users",
    "view_teams",
    "view_tasks",
    "manage_tasks"
  ],
  hr: ["view_dashboard", "view_users", "manage_users", "view_teams"],
  employee: ["view_dashboard", "view_teams", "view_tasks", "update_own_task_status"]
};

export function getPermissionsForRole(role) {
  return permissionsByRole[role] || [];
}

export function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}
