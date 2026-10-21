import { config, rulesForGameMode } from "./config";
import { companyModelCounts } from "./company";
import { dailyRoundKey, startDailyRound, utcDayKey, type DailyRound } from "./daily";
import { difficultyFromStored, difficultyNumber, type Difficulty } from "./difficulty";
import { buildTraits, gameModeAllowsHints } from "./game";
import { serviceOrThrow } from "./rounds-db";
import { loadCatalog, loadModel, rpc } from "./rounds-queries";
import { difficultyCounts, fail, fromRpc, presentLogo, type ApiFailure } from "./rounds-shape";

export async function listGameModes() {
  const client = serviceOrThrow();
  const { data, error } = await client
    .from("game_modes")
    .select("id, name, blurb, enabled, sort_order, leaderboard")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listBoardOptions() {
  const client = serviceOrThrow();
  const [categories, companies] = await Promise.all([
    client.from("categories").select("id, name").order("name"),
    client.from("companies").select("id, name, logo_path").order("name"),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (companies.error) throw new Error(companies.error.message);
  return {
    categories: (categories.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
    companies: (companies.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      logoUrl: presentLogo((row.logo_path as string | null) ?? "", row.id as string),
    })),
  };
}

export async function lobbyState(userId: string) {
  const client = serviceOrThrow();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const day = utcDayKey();
  const [{ data: settings }, { count }, activeResult, { data: dailyToday }, catalog, companyRows] = await Promise.all([
    client.from("app_settings").select("paused").eq("id", 1).single(),
    client.from("games").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("started_at", since),
    client.from("games").select("id, game_mode, difficulty, pool_key").eq("user_id", userId).eq("status", "active"),
    client.from("games").select("status, difficulty").eq("user_id", userId).eq("game_mode", "daily").like("daily_key", `${day}:%`),
    loadCatalog(client),
    client.from("companies").select("id, name, logo_path").order("name"),
  ]);
  let nextAt: string | null = null;
  if ((count ?? 0) > 0) {
    const { data: oldest } = await client
      .from("games")
      .select("started_at")
      .eq("user_id", userId)
      .gt("started_at", since)
      .order("started_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (oldest?.started_at) {
      nextAt = new Date(new Date(oldest.started_at as string).getTime() + 60 * 60 * 1000).toISOString();
    }
  }
  if (activeResult.error) throw new Error(activeResult.error.message);
  if (companyRows.error) throw new Error(companyRows.error.message);
  const logos = new Map(
    (companyRows.data ?? []).map((row) => [row.id as string, (row.logo_path as string | null) ?? ""]),
  );
  const companies = companyModelCounts(
    (companyRows.data ?? []).flatMap((row) =>
      typeof row.id === "string" && typeof row.name === "string" ? [{ id: row.id, name: row.name }] : [],
    ),
    catalog.map((model) => ({ companyId: model.companyId, enabled: true })),
  ).map((company) => ({
    ...company,
    logoUrl: presentLogo(logos.get(company.id) ?? "", company.id),
  }));
  return {
    paused: Boolean(settings?.paused),
    played: count ?? 0,
    cap: config.hourlyCap,
    openGames: (activeResult.data ?? []).flatMap((row) => {
      const id = typeof row.id === "string" ? row.id : null;
      const mode = typeof row.game_mode === "string" ? row.game_mode : null;
      if (!id || !mode) return [];
      const companyId = mode === "company" && typeof row.pool_key === "string" ? row.pool_key : null;
      return [{ id, mode, difficulty: difficultyFromStored(row.difficulty), companyId }];
    }),
    dailyFinished: (dailyToday ?? []).flatMap((row) => {
      if (row.status === "active") return [];
      const level = difficultyFromStored(row.difficulty);
      return level ? [level] : [];
    }),
    poolSize: catalog.length,
    difficultyCounts: difficultyCounts(catalog),
    companies,
    nextAt,
  };
}

export function startAllModels(userId: string, noHint: boolean, difficulty: Difficulty) {
  return startRosterRound(userId, "all", noHint, difficulty);
}

export function startDaily(userId: string, noHint: boolean, difficulty: Difficulty) {
  return startRosterRound(userId, "daily", noHint, difficulty);
}

/** One company. Enabled models from that lab only. No difficulty. Year and size can be bought. */
export async function startCompany(userId: string, companyId: string, noHint = false): Promise<{ gameId: string } | ApiFailure> {
  const id = companyId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return fail(422, "company");
  const client = serviceOrThrow();
  const [{ data: gameMode, error }, { data: company, error: companyError }, catalog] = await Promise.all([
    client.from("game_modes").select("id, enabled, hints_allowed").eq("id", "company").maybeSingle(),
    client.from("companies").select("id").eq("id", id).maybeSingle(),
    loadCatalog(client),
  ]);
  if (error) throw new Error(error.message);
  if (companyError) throw new Error(companyError.message);
  if (!gameMode?.enabled || !company) return fail(404, "not_found");
  const pool = catalog.filter((model) => model.companyId === id);
  const modelId = pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
  if (pool.length < 2 || !modelId) return fail(422, "pool_too_small");
  const result = await rpc(client, "start_game", {
    p_user_id: userId,
    p_hourly_cap: config.hourlyCap,
    p_game_mode: "company",
    p_pool_key: id,
    p_no_hint: noHint,
    p_model_id: modelId,
    p_pool_model_ids: pool.map((model) => model.id),
    p_traits: buildTraits(pool),
    p_rules: rulesForGameMode(Boolean(gameMode.hints_allowed) && gameModeAllowsHints("company")),
    p_difficulty: null,
  });
  const failure = fromRpc(result);
  if (failure) return failure;
  return { gameId: result.gameId as string };
}

async function startRosterRound(
  userId: string,
  modeId: "all" | "daily",
  noHint: boolean,
  difficulty: Difficulty,
): Promise<{ gameId: string } | ApiFailure> {
  const client = serviceOrThrow();
  const { data: gameMode, error } = await client
    .from("game_modes")
    .select("id, enabled, hints_allowed")
    .eq("id", modeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!gameMode?.enabled) return fail(404, "not_found");

  let pool = await loadCatalog(client, difficulty);
  let modelId = pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
  if (modeId === "daily") {
    const day = utcDayKey();
    const [roundResult, pickResult] = await Promise.all([
      client
        .from("games")
        .select("id, status, model_id, difficulty")
        .eq("user_id", userId)
        .eq("game_mode", "daily")
        .eq("daily_key", dailyRoundKey(day, difficulty))
        .maybeSingle(),
      client
        .from("daily_models")
        .select("model_id")
        .eq("played_on", day)
        .eq("difficulty", difficultyNumber[difficulty])
        .maybeSingle(),
    ]);
    if (roundResult.error) throw new Error(roundResult.error.message);
    if (pickResult.error) throw new Error(pickResult.error.message);
    const storedId = (pickResult.data?.model_id as string | undefined) ?? null;
    const row = roundResult.data;
    const round: DailyRound | null = row
      ? {
          id: row.id as string,
          day,
          status: row.status as DailyRound["status"],
          modelId: row.model_id as string,
          difficulty: difficultyFromStored(row.difficulty) ?? difficulty,
        }
      : null;
    const decision = startDailyRound({
      day,
      difficulty,
      roster: pool.map((model) => ({ id: model.id, difficulty: model.difficulty })),
      picks: storedId ? [{ day, difficulty, modelId: storedId }] : [],
      round,
      roll: (count) => Math.floor(Math.random() * count),
    });
    if (decision.kind === "resume") return { gameId: decision.gameId };
    if (decision.kind === "done") return fail(409, "daily_done");
    if (decision.kind === "empty") return fail(422, "pool_too_small");
    modelId = decision.modelId;
    if (!pool.some((model) => model.id === modelId)) {
      const extra = await loadModel(client, modelId);
      if (extra) pool = [...pool, extra];
    }
  }
  if (pool.length < 2 || !modelId || !pool.some((model) => model.id === modelId)) return fail(422, "pool_too_small");
  const result = await rpc(client, "start_game", {
    p_user_id: userId,
    p_hourly_cap: config.hourlyCap,
    p_game_mode: modeId,
    p_pool_key: null,
    p_no_hint: noHint,
    p_model_id: modelId,
    p_pool_model_ids: pool.map((model) => model.id),
    p_traits: buildTraits(pool),
    p_rules: rulesForGameMode(Boolean(gameMode.hints_allowed) && gameModeAllowsHints(gameMode.id)),
    p_difficulty: difficultyNumber[difficulty],
  });
  const failure = fromRpc(result);
  if (failure) return failure;
  return { gameId: result.gameId as string };
}
