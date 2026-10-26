const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GameSearch = { kind: "all" } | { kind: "id"; id: string } | { kind: "username"; text: string };

/** A game id finds that game; any other text is part of a username. Empty text lists the latest games. */
export function parseGameSearch(raw: string | undefined): GameSearch {
  const text = (raw ?? "").trim().slice(0, 100);
  if (text === "") return { kind: "all" };
  if (uuid.test(text)) return { kind: "id", id: text.toLowerCase() };
  return { kind: "username", text };
}

/** Escapes the characters `ilike` treats as wildcards, and the ones PostgREST reads as filter syntax. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export type TranscriptRow = { turn: number; role: string; content: string };

/** Turn order, the player before the model inside one exchange. */
export function orderTranscript<T extends { turn: number; role: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.turn - b.turn || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1));
}
