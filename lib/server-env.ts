const REDACTED = "[SENSITIVE]";

// `vercel pull` writes this placeholder for Secret env vars. Next does not inline
// server `process.env` reads, but a non-empty placeholder is still a value: the
// activity call sends it, and OpenRouter answers 401 "Missing Authentication header".
// A dynamic lookup stays a runtime read, so the Vercel project secret is used.
export function readServerEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value || value === REDACTED) return undefined;
  return value;
}
