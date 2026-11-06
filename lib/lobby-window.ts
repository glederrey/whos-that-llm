const hourMs = 60 * 60 * 1000;

/**
 * The rounds a player started in the last hour, oldest first, give both the count against the hourly cap and
 * when the oldest one drops out of the window. One read replaces a count query plus an oldest-row query.
 * `startedAt` values at or before `sinceMs` are ignored, so a caller may pass a slightly wider read.
 */
export function hourlyWindow(startedAt: readonly (string | null | undefined)[], sinceMs: number): { played: number; nextAt: string | null } {
  const times = startedAt
    .map((value) => (typeof value === "string" ? new Date(value).getTime() : Number.NaN))
    .filter((time) => Number.isFinite(time) && time > sinceMs);
  if (times.length === 0) return { played: 0, nextAt: null };
  return { played: times.length, nextAt: new Date(Math.min(...times) + hourMs).toISOString() };
}
