import { chooseLogoPath } from "./logos";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentRules } from "./config";
import { loadCategoryEntries } from "./category-data";
import { difficultyNumber, type BoardDifficulty, type Difficulty } from "./difficulty";
import { playableHints, type GuessFlags, type Traits } from "./game";
import {
  bestOwnGame,
  boardFilters,
  boardRows,
  markLegacyRows,
  type BoardEntry,
  type BoardRow,
} from "./rounds-board-rows";
import { scoreGame } from "./rounds-score";
import {
  catalogColumns,
  fail,
  mapCatalog,
  first,
  presentLogo,
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

/**
 * A round freezes each model's logo when it starts, so a logo changed in the admin later would
 * not show in rounds already played. Read the current logos again and put them on the traits.
 */
export async function withCurrentLogos(client: SupabaseClient, traits: Traits): Promise<Traits> {
  const ids = Object.keys(traits.models);
  if (ids.length === 0) return traits;
  const { data, error } = await client.from("models").select("id, company_id, logo_path, companies(logo_path)").in("id", ids);
  if (error) throw new Error(error.message);
  const models = { ...traits.models };
  for (const row of data ?? []) {
    const record = row as { id: string; company_id: string; logo_path: string | null; companies: { logo_path: string } | { logo_path: string }[] | null };
    const frozen = models[record.id];
    const path = chooseLogoPath(record.logo_path, first(record.companies)?.logo_path);
    if (frozen && path) models[record.id] = { ...frozen, logoPath: presentLogo(path, record.company_id) };
  }
  return { ...traits, models };
}

/**
 * The same refresh as `withCurrentLogos`, from the cached catalog instead of a query. The catalog holds the
 * enabled models with their current logo, and an admin logo edit refreshes it. A model that is turned off
 * since the round started keeps the logo frozen on the round.
 */
export function withCatalogLogos(traits: Traits, catalog: readonly Pick<CatalogModel, "id" | "logoPath">[]): Traits {
  if (catalog.length === 0) return traits;
  const current = new Map(catalog.map((model) => [model.id, model.logoPath]));
  const models = { ...traits.models };
  for (const [id, frozen] of Object.entries(traits.models)) {
    const logoPath = current.get(id);
    if (logoPath) models[id] = { ...frozen, logoPath };
  }
  return { ...traits, models };
}

/**
 * `logos: false` skips the extra read of current logos. Only display needs them,
 * so write paths (guess, hint, give up) turn them off.
 */
export async function loadGame(
  client: SupabaseClient,
  gameId: string,
  userId: string,
  options: { logos?: boolean } = {},
): Promise<GameRow | null> {
  const { data, error } = await client.from("games").select("*").eq("id", gameId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return rowWithTraits(client, (data as GameRow | null) ?? null, options.logos !== false);
}

export async function rowWithTraits(client: SupabaseClient, game: GameRow | null, logos: boolean): Promise<GameRow | null> {
  if (!game) return null;
  const traits = presentTraits(game.traits);
  return {
    ...game,
    traits: logos ? await withCurrentLogos(client, traits) : traits,
    rules: currentRules(game.rules),
    hints: playableHints(game.hints),
  };
}

/** The token usage of one round, oldest call first. Never throws: the caller decides when the error matters. */
export async function readUsage(client: SupabaseClient, gameId: string) {
  return client
    .from("usage")
    .select("input_tokens, output_tokens")
    .eq("game_id", gameId)
    .is("error_code", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
}

/** Pass `usage` when it was read already, beside the other reads, so scoring costs no extra round trip. */
export async function scoreFrom(
  client: SupabaseClient,
  game: GameRow,
  guesses: GuessFlags[],
  namedModel: boolean,
  usage?: Awaited<ReturnType<typeof readUsage>>,
) {
  const { data, error } = usage ?? (await readUsage(client, game.id));
  if (error) throw new Error(error.message);
  return scoreGame(game, guesses, namedModel, data ?? []);
}

/** `companyId` narrows a Company board, and a Category board to one category. */
export async function leaderboardWith(
  client: SupabaseClient,
  gameMode: string,
  period: string,
  viewerId?: string | null,
  difficulty?: BoardDifficulty | null,
  companyId?: string | null,
): Promise<{ rows: BoardRow[] } | ApiFailure> {
  // The category icons only matter for a Category board, and do not depend on the rows: read them beside the rpc.
  const categories = gameMode === "class" ? loadCategoryEntries(client).catch(() => null) : null;
  const result = await leaderboardRows(client, gameMode, period, viewerId, difficulty, companyId);
  if (!categories || !("rows" in result) || result.rows.length === 0) return result;
  const icons = new Map(((await categories) ?? []).map((item) => [item.id, item.icon]));
  return { rows: result.rows.map((row) => ({ ...row, categoryIcon: row.companyId ? (icons.get(row.companyId) ?? null) : null })) };
}

/**
 * The database does not have this rpc signature: PostgREST says PGRST202 (not in the schema cache)
 * and Postgres says 42883 (undefined_function). Any other error is a real failure, not an old schema.
 */
export function isMissingRpcSignature(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

async function leaderboardRows(
  client: SupabaseClient,
  gameMode: string,
  period: string,
  viewerId?: string | null,
  difficulty?: BoardDifficulty | null,
  companyId?: string | null,
): Promise<{ rows: BoardRow[] } | ApiFailure> {
  const filters = boardFilters(gameMode, period, difficulty, companyId);
  const since = filters.since;
  const pickedDifficulty = filters.difficulty;
  const pickedCompany = filters.company;
  // The mode flag and the newest rpc do not depend on each other: one round trip instead of two.
  const [{ data: row, error: modeError }, fresh] = await Promise.all([
    client.from("game_modes").select("leaderboard").eq("id", gameMode).maybeSingle(),
    client.rpc("leaderboard", {
      game_mode: gameMode,
      since,
      viewer: viewerId ?? null,
      p_difficulty: pickedDifficulty,
      p_company: pickedCompany,
    }),
  ]);
  if (modeError) throw new Error(modeError.message);
  if (!row?.leaderboard) return fail(404, "not_found");
  if (!fresh.error) {
    return { rows: boardRows(fresh.data) };
  }
  // Databases that have not run the latest migration only have the older leaderboard signatures.
  if (!isMissingRpcSignature(fresh.error)) throw new Error(fresh.error.message);
  const previous = await client.rpc("leaderboard", {
    game_mode: gameMode,
    since,
    viewer: viewerId ?? null,
    p_difficulty: pickedDifficulty,
  });
  if (!previous.error) {
    return { rows: boardRows(previous.data) };
  }
  if (!isMissingRpcSignature(previous.error)) throw new Error(previous.error.message);
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
