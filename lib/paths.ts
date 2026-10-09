export function safeNext(value: string | undefined, fallback = "/play"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
