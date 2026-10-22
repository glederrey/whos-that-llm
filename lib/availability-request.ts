import { createHash, timingSafeEqual } from "node:crypto";

/** True only for `Authorization: Bearer <expected>`. An unset or empty expected token matches nothing. */
export function tokenMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  const match = /^Bearer (.+)$/i.exec(header.trim());
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(expected));
}

/** Equal-length hashes, so the comparison never depends on the token length. */
function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Writes happen only for exactly `?apply=true`. Anything else is a dry run. */
export function wantsApply(value: string | null): boolean {
  return value === "true";
}
