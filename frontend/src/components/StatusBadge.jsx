import { formatBadgeLabel } from "../utils/formatters";
import { Badge } from "./ui/badge";

export default function StatusBadge({ value }) {
  const toneMap = {
    todo: "muted",
    in_progress: "warning",
    done: "success",
    blocked: "danger",
    admin: "danger",
    director: "danger",
    manager: "warning",
    team_lead: "warning",
    hr: "secondary",
    employee: "success",
    low: "success",
    medium: "warning",
    high: "danger"
  };

  return <Badge variant={toneMap[value] || "muted"}>{formatBadgeLabel(value)}</Badge>;
}
