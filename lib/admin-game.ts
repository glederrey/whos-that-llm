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

/** The `page` query value as a page number from 1. Anything else is page 1. */
export function pageNumber(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}

/** "2026-10-24T16:39:46.359601+00:00" as "2026-10-24 16:39:46 UTC". */
export function utcStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export type ScoreLine = { label: string; points: number | null; multiplier: string | null };

/** The stored breakdown, keeping only well-formed lines. */
export function scoreLines(raw: unknown): ScoreLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { label, points, multiplier } = item as Record<string, unknown>;
    if (typeof label !== "string") return [];
    return [{ label, points: typeof points === "number" ? points : null, multiplier: typeof multiplier === "string" ? multiplier : null }];
  });
}
