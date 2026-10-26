export const expireAfterDays = 7;

/** Rounds started before this instant are stale. */
export function staleCutoff(now: Date, days = expireAfterDays): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
