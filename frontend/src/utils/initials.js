// src/utils/initials.js
export function getInitials(text, fallback = "·") {
  if (!text) return fallback;
  const result = text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return result || fallback;
}

// src/utils/cx.js
export const cx = (...classes) => classes.filter(Boolean).join(" ");