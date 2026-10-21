import type { SupabaseClient } from "@supabase/supabase-js";
import { currentRules } from "./config";
import { countedPlayerId } from "./anonymize-account";
import { difficultyNumber, type BoardDifficulty, type Difficulty } from "./difficulty";
import { playableHints, type GuessFlags } from "./game";
import {
  bestOwnGame,
  boardFilters,
  boardRows,
  markLegacyRows,
  parseStats,
  utcDayWindow,
  type BoardEntry,
  type BoardRow,
} from "./rounds-board-rows";
import { scoreGame } from "./rounds-score";
import {
  catalogColumns,
  fail,
  mapCatalog,
  presentTraits,
  type ApiFailure,
  type CatalogModel,
  type GameRow,
  type RpcResult,
} from "./rounds-shape";

/**
 * Reads and rpc calls that take the Supabase client as an argument. This module
 * never builds a client, so a test can pass a hand-written fake.
 */

export async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as RpcResult;
}

export async function loadCatalog(client: SupabaseClient, maxDifficulty?: Difficulty): Promise<CatalogModel[]> {
  let query = client.from("models").select(catalogColumns).eq("enabled", true);
  if (maxDifficulty) query = query.lte("difficulty", difficultyNumber[maxDifficulty]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapCatalog(data ?? []);
}

export async function loadModel(client: SupabaseClient, id: string): Promise<CatalogModel | null> {
  const { data, error } = await client.from("models").select(catalogColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return mapCatalog(data ? [data] : [])[0] ?? null;
}

export async function loadGame(client: SupabaseClient, gameId: string, userId: string): Promise<GameRow | null> {
  const { data, error } = await client.from("games").select("*").eq("id", gameId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const game = (data as GameRow | null) ?? null;
  return game ? { ...game, traits: presentTraits(game.traits), rules: currentRules(game.rules), hints: playableHints(game.hints) } : null;
}

export async function scoreFrom(client: SupabaseClient, game: GameRow, guesses: GuessFlags[], namedModel: boolean) {
  const { data, error } = await client
    .from("usage")
    .select("input_tokens, output_tokens")
    .eq("game_id", game.id)
    .is("error_code", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return scoreGame(game, guesses, namedModel, data ?? []);
}

export async function leaderboardWith(
  client: SupabaseClient,
  gameMode: string,
  period: string,
  viewerId?: string | null,
  difficulty?: BoardDifficulty | null,
  companyId?: string | null,
): Promise<{ rows: BoardRow[] } | ApiFailure> {
  const { data: row, error: modeError } = await client.from("game_modes").select("leaderboard").eq("id", gameMode).maybeSingle();
  if (modeError) throw new Error(modeError.message);
  if (!row?.leaderboard) return fail(404, "not_found");
  const filters = boardFilters(gameMode, period, difficulty, companyId);
  const since = filters.since;
  const pickedDifficulty = filters.difficulty;
  const pickedCompany = filters.company;
  const fresh = await client.rpc("leaderboard", {
    game_mode: gameMode,
    since,
    viewer: viewerId ?? null,
    p_difficulty: pickedDifficulty,
    p_company: pickedCompany,
  });
  if (!fresh.error) {
    return { rows: boardRows(fresh.data) };
  }
  // Databases that have not run the latest migration only have the older leaderboard signatures.
  const previous = await client.rpc("leaderboard", {
    game_mode: gameMode,
    since,
    viewer: viewerId ?? null,
    p_difficulty: pickedDifficulty,
  });
  if (!previous.error) {
    return { rows: boardRows(previous.data) };
  }
  const legacy = await client.rpc("leaderboard", { game_mode: gameMode, since });
  if (legacy.error) throw new Error(legacy.error.message);
  const rows = await markLegacyMine(client, (legacy.data ?? []) as BoardEntry[], viewerId, gameMode, since);
  return { rows };
}

async function markLegacyMine(
  client: SupabaseClient,
  data: BoardEntry[],
  viewerId: string | null | undefined,
  gameMode: string,
  since: string,
): Promise<BoardRow[]> {
  let best: { username: string; score: number } | null = null;
  if (viewerId) {
    const { data: games, error } = await client
      .from("games")
      .select("username, score")
      .eq("user_id", viewerId)
      .eq("game_mode", gameMode)
      .in("status", ["solved", "miss"])
      .gte("finished_at", since)
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    best = bestOwnGame(games);
  }
  return markLegacyRows(data, best);
}

export async function readPublicStats(client: SupabaseClient) {
  const { data, error } = await client.rpc("public_stats");
  if (!error && data && typeof data === "object") {
    const stats = parseStats(data);
    return {
      models: stats.models,
      gamesToday: stats.gamesToday,
      players: stats.players,
      companies: stats.companies ?? (await countCompanies(client)),
    };
  }
  const { start, end } = utcDayWindow();
  const [models, gamesToday, players, companies] = await Promise.all([
    client.from("models").select("id", { count: "exact", head: true }).eq("enabled", true),
    client
      .from("games")
      .select("id", { count: "exact", head: true })
      .gte("finished_at", start)
      .lt("finished_at", end),
    countPlayers(client),
    countCompanies(client),
  ]);
  if (models.error) throw new Error(models.error.message);
  if (gamesToday.error) throw new Error(gamesToday.error.message);
  return { models: models.count ?? 0, gamesToday: gamesToday.count ?? 0, players, companies };
}

async function countCompanies(client: SupabaseClient) {
  const ids = new Set<string>();
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await client
      .from("models")
      .select("company_id")
      .eq("enabled", true)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (typeof row.company_id === "string" && row.company_id) ids.add(row.company_id);
    }
    if (!data || data.length < 1000) break;
  }
  return ids.size;
}

async function countPlayers(client: SupabaseClient) {
  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await client
      .from("games")
      .select("user_id")
      .not("finished_at", "is", null)
      .not("user_id", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = countedPlayerId(row.user_id);
      if (id) ids.add(id);
    }
    if (!data || data.length < 1000) break;
  }
  return ids.size;
}

/** The username rpc on the signed-in user's own client, mapped to an http failure. */
export async function saveUsername(session: SupabaseClient, raw: string): Promise<ApiFailure | null> {
  const { data, error } = await session.rpc("set_username", { p_username: raw });
  if (error) return fail(500, "server");
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    if (result?.error === "unauthorized") return fail(401, "unauthorized");
    return fail(422, "username");
  }
  return null;
}
