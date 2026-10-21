export const REPLY_FAILED = "The reply failed. Send it again.";
export const GAME_PAUSED = "The game is paused. Try again later.";

export type OpenableHint = "year" | "size";

// Notice shown when a model reply cannot be delivered.
export function replyFailureNotice(paused: boolean | undefined): string {
  return paused ? GAME_PAUSED : REPLY_FAILED;
}

// Candidates whose model or company name contains the search text.
export function filterCandidates<T extends { name: string; companyName: string }>(candidates: T[], search: string): T[] {
  const query = search.trim().toLowerCase();
  return candidates.filter((row) => {
    if (!query) return true;
    return row.name.toLowerCase().includes(query) || row.companyName.toLowerCase().includes(query);
  });
}

// Hints already opened on this device, read back from session storage.
export function parseOpenedHints(raw: string): OpenableHint[] {
  try {
    return JSON.parse(raw) as OpenableHint[];
  } catch {
    return [];
  }
}

export function withOpenedHint(opened: OpenableHint[], key: OpenableHint): OpenableHint[] {
  return opened.includes(key) ? opened : [...opened, key];
}
