// src/config/navigation.js
import { LayoutDashboard, Users, ListChecks, UserCog } from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard",    path: "/",       description: "Vue globale",       permission: "view_dashboard", icon: LayoutDashboard },
  { label: "Equipes",      path: "/teams",  description: "Organisation",      permission: "view_teams",     icon: Users },
  { label: "Taches",       path: "/tasks",  description: "Execution",         permission: "view_tasks",     icon: ListChecks },
  { label: "Utilisateurs", path: "/users",  description: "Comptes et roles",  permission: "view_users",     icon: UserCog },
];

// Keep in sync with CSS desktop switch at min-width: 1080px.
export const BREAKPOINTS = { mobileNav: 1079 };
