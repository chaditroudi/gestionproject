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

export const workspaceByRole = {
  admin: {
    title: "Espace Administration",
    description: "Pilotage global, gouvernance et gestion complete de la plateforme."
  },
  director: {
    title: "Espace Direction",
    description: "Vision transversale, suivi de la performance et arbitrage des priorites."
  },
  manager: {
    title: "Espace Management",
    description: "Coordination des equipes, allocation des ressources et suivi d'execution."
  },
  team_lead: {
    title: "Espace Chef d'equipe",
    description: "Animation du terrain, pilotage des taches et accompagnement des collaborateurs."
  },
  hr: {
    title: "Espace RH",
    description: "Gestion des comptes, des roles et de l'organisation humaine."
  },
  employee: {
    title: "Espace Employe",
    description: "Suivi de ses taches, de ses equipes et de ses responsabilites quotidiennes."
  }
};

export function getPermissionsForRole(role) {
  return permissionsByRole[role] || [];
}

export function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function getWorkspace(role) {
  return workspaceByRole[role] || workspaceByRole.employee;
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

export function getDefaultRouteForRole(role) {
  if (hasPermission(role, "view_dashboard")) {
    return "/";
  }

  if (hasPermission(role, "view_tasks")) {
    return "/tasks";
  }

  if (hasPermission(role, "view_teams")) {
    return "/teams";
  }

  if (hasPermission(role, "view_users")) {
    return "/users";
  }

  return "/";
}
