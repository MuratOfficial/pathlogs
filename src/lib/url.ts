/**
 * Приводит введённый адрес к нормальному виду и отсекает опасные схемы.
 * Разрешены только http/https: ссылка рендерится как <a href>, поэтому
 * javascript:, data: и подобные схемы пропускать нельзя.
 * Адрес без схемы считаем https.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return parsed.toString();
}

/** Хост ссылки — подпись, когда у ссылки не задано название. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
