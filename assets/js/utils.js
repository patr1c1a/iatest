export async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url}`);
  }

  return response.json();
}

export function shuffle(items) {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildApiUrl(baseUrl, pathTemplate, replacements = {}) {
  const normalizedBase = (baseUrl || "").replace(/\/$/, "");
  const builtPath = Object.entries(replacements).reduce(
    (currentPath, [key, value]) =>
      currentPath.replaceAll(`{${key}}`, encodeURIComponent(String(value))),
    pathTemplate,
  );

  return `${normalizedBase}${builtPath}`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function normalizeTieKey(profileA, profileB) {
  return [profileA, profileB].sort((left, right) => left.localeCompare(right)).join("|");
}

export function inferCountry() {
  const locale = navigator.languages?.[0] || navigator.language || "";

  try {
    if (typeof Intl.Locale === "function") {
      const parsed = new Intl.Locale(locale);
      return parsed.region || "";
    }
  } catch {
    return "";
  }

  return "";
}

export function readTokenFromUrl() {
  const currentUrl = new URL(window.location.href);
  return currentUrl.searchParams.get("t") || "";
}

export function sanitizeFileSegment(value) {
  return String(value || "reporte")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-zA-Z0-9-_]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .toLowerCase();
}
