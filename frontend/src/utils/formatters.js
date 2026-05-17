export function formatDate(value) {
  if (!value) {
    return "Non definie";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Non definie";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

export function formatDateTime(value) {
  if (!value) {
    return "Non defini";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Non defini";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

export function formatBadgeLabel(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getProgress(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}
