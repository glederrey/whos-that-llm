import { boardSeed } from "./board-seed";
import { boardSince } from "./board-query";
import { difficultyFromStored, difficultyNumber, type BoardDifficulty, type Difficulty } from "./difficulty";
import { avatarPublicUrl } from "./profile";
import { presentLogo } from "./rounds-shape";
import { publicEnv } from "./supabase/env";

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  mine: boolean;
  avatarUrl: string | null;
  seed: string;
  difficulty: Difficulty | null;
  noHint: boolean;
  companyId: string | null;
  companyName: string | null;
  companyLogo: string | null;
};

export type BoardEntry = {
  rank: number;
  name: string;
  score: number;
  mine?: boolean;
  user_id?: string | null;
  avatar_path?: string | null;
  difficulty?: number | string | null;
  no_hint?: boolean | null;
  company_id?: string | null;
  company_name?: string | null;
  company_logo?: string | null;
};

export function toBoardRow(entry: BoardEntry, mine: boolean): BoardRow {
  const userId = typeof entry.user_id === "string" ? entry.user_id : "";
  return {
    rank: Number(entry.rank),
    name: entry.name,
    score: Number(entry.score),
    mine,
    avatarUrl: avatarPublicUrl(publicEnv()?.url ?? "", entry.avatar_path ?? null),
    seed: boardSeed(userId, entry.name, mine),
    difficulty: difficultyFromStored(entry.difficulty),
    noHint: Boolean(entry.no_hint),
    companyId: typeof entry.company_id === "string" ? entry.company_id : null,
    companyName: typeof entry.company_name === "string" ? entry.company_name : null,
    companyLogo:
      typeof entry.company_logo === "string" && typeof entry.company_id === "string"
        ? presentLogo(entry.company_logo, entry.company_id)
        : null,
  };
}

/** Rows from a leaderboard rpc that already says which row is the viewer's. */
export function boardRows(data: unknown): BoardRow[] {
  return ((data ?? []) as BoardEntry[]).map((entry) => toBoardRow(entry, Boolean(entry.mine)));
}

/** Filters for the leaderboard rpc: period start, difficulty number, company id. */
export function boardFilters(
  gameMode: string,
  period: string,
  difficulty?: BoardDifficulty | null,
  companyId?: string | null,
) {
  return {
    since: boardSince(period === "month" || period === "all" ? period : "week"),
    difficulty: gameMode === "company" || !difficulty || difficulty === "any" ? null : difficultyNumber[difficulty],
    company: gameMode === "company" && companyId ? companyId : null,
  };
}

/** The viewer's best finished game in the rows the database returned, or null. */
export function bestOwnGame(games: Array<{ username?: unknown; score?: unknown }> | null | undefined) {
  const row = games?.[0];
  if (row && typeof row.score === "number") return { username: row.username as string, score: row.score };
  return null;
}

/** Old databases cannot flag the viewer: match the best own game by name and score. */
export function markLegacyRows(data: BoardEntry[], best: { username: string; score: number } | null): BoardRow[] {
  return data.map((entry) =>
    toBoardRow(entry, Boolean(best && entry.name === best.username && Number(entry.score) === best.score)),
  );
}

/** Counts from the public_stats rpc. `companies` is null when the rpc did not send a number. */
export function parseStats(data: object) {
  const stats = data as { models?: number; gamesToday?: number; players?: number; companies?: number };
  return {
    models: Number(stats.models ?? 0),
    gamesToday: Number(stats.gamesToday ?? 0),
    players: Number(stats.players ?? 0),
    companies: typeof stats.companies === "number" ? stats.companies : null,
  };
}

/** Start and end (ISO) of the UTC day holding `now`. */
export function utcDayWindow(now: Date = new Date()) {
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    start: startDate.toISOString(),
    end: new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
