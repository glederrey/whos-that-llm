export const REPLY_FAILED = "The reply failed. Send it again.";
export const GAME_PAUSED = "The game is paused. Try again later.";

// Notice shown when a model reply cannot be delivered.
export function replyFailureNotice(paused: boolean | undefined): string {
  return paused ? GAME_PAUSED : REPLY_FAILED;
}

// Candidates whose model or company name contains the search text.
export function filterCandidates<T extends { name: string; companyName: string }>(
  candidates: T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  return candidates.filter((row) => {
    if (!query) return true;
    return row.name.toLowerCase().includes(query) || row.companyName.toLowerCase().includes(query);
  });
}

// Year and size show once bought, or at once when every model in the pool shares the value.
export function hintShown(
  hints: { year?: unknown; size?: unknown },
  given: ReadonlySet<string>,
  key: "year" | "size",
): boolean {
  return Boolean(hints[key]) || given.has(key);
}
