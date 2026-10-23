import { difficultyNumber, isDifficulty } from "./difficulty";
import type { GameStatus } from "./game";

/** What the Games list on the profile can be narrowed by. Every field is optional. */
export type HistoryFilter = {
  /** First day, `YYYY-MM-DD`, UTC. */
  from?: string;
  /** Last day, `YYYY-MM-DD`, UTC, included. */
  to?: string;
  status?: GameStatus;
  mode?: string;
  /** A difficulty for the modes that have one, else the category or company id. */
  level?: string;
};

const statuses: readonly GameStatus[] = ["active", "solved", "miss", "given_up"];
const modeIdPattern = /^[a-z0-9_-]{1,40}$/;
const levelPattern = /^[A-Za-z0-9_.-]{1,80}$/;

/** A real calendar day written as `YYYY-MM-DD`, or null. */
export function cleanDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** Anything that is not a clean value is dropped, so a bad query string reads as no filter. */
export function parseHistoryFilter(input: Record<string, unknown>): HistoryFilter {
  const filter: HistoryFilter = {};
  const from = cleanDay(input.from);
  const to = cleanDay(input.to);
  if (from) filter.from = from;
  if (to) filter.to = to;
  if (typeof input.status === "string" && (statuses as readonly string[]).includes(input.status)) {
    filter.status = input.status as GameStatus;
  }
  if (typeof input.mode === "string" && modeIdPattern.test(input.mode)) {
    filter.mode = input.mode;
    if (typeof input.level === "string" && levelPattern.test(input.level)) filter.level = input.level;
  }
  return filter;
}

/** The `started_at` window as ISO instants: from the start of the first day to the start of the day after the last. */
export function dayWindow(filter: HistoryFilter): { since: string | null; before: string | null } {
  const since = filter.from ? `${filter.from}T00:00:00.000Z` : null;
  let before: string | null = null;
  if (filter.to) {
    const next = new Date(`${filter.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    before = next.toISOString();
  }
  return { since, before };
}

/**
 * The column and value a level filter reads. A difficulty mode takes a difficulty name, stored as a number 1 to 4.
 * Category and Company take the pool key. Origin and Custom have no level.
 */
export function levelQuery(mode: string | undefined, level: string): { column: "difficulty" | "pool_key"; value: string } | null {
  if (mode === "company" || mode === "class") return { column: "pool_key", value: level };
  if (mode === "origin" || mode === "custom") return null;
  return isDifficulty(level) ? { column: "difficulty", value: String(difficultyNumber[level]) } : null;
}

/** The best score among solved rounds only. A failed or given-up round never takes the cup. */
export function bestSolvedScore(games: { status: GameStatus; score: number | null }[]): number | null {
  const scores = games.flatMap((game) => (game.status === "solved" && game.score !== null ? [game.score] : []));
  return scores.length === 0 ? null : Math.max(...scores);
}

export function isBestSolved(game: { status: GameStatus; score: number | null }, best: number | null): boolean {
  return best !== null && game.status === "solved" && game.score === best;
}
