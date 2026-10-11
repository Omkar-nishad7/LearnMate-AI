export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0";
  }
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

export function formatPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "0%";
  return `${num}%`;
}

export function truncateText(text = "", length = 80) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}

export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}