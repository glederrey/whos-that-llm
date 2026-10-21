const site = "https://www.whos-that-llm.com";

export function safeNext(value: string | undefined, fallback = "/"): string {
  if (!value || value !== value.trim()) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || value.includes("\0")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/%2f|%5c/i.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, site);
  } catch {
    return fallback;
  }
  if (url.origin !== site) return fallback;
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
