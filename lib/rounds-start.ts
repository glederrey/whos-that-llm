import { parseCategoryId } from "./admin-category";
import { loadCategoryEntries } from "./category-data";
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
    loadCategoryEntries(client),
    client.from("companies").select("id, name, logo_path").order("name"),
  ]);
  if (!categories) throw new Error("Could not read categories.");
  if (companies.error) throw new Error(companies.error.message);
  return {
    categories: categories.map((row) => ({ id: row.id, name: row.name, icon: row.icon })),
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
  const [{ data: settings }, { count }, activeResult, { data: dailyToday }, catalog, companyRows, categoryEntries, memberships] = await Promise.all([
    client.from("app_settings").select("paused").eq("id", 1).single(),
    client.from("games").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("started_at", since),
    client.from("games").select("id, game_mode, difficulty, pool_key").eq("user_id", userId).eq("status", "active"),
    client.from("games").select("status, difficulty").eq("user_id", userId).eq("game_mode", "daily").like("daily_key", `${day}:%`),
    loadCatalog(client),
    client.from("companies").select("id, name, logo_path").order("name"),
    loadCategoryEntries(client),
    client.from("model_categories").select("model_id, category_id"),
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
  if (!categoryEntries || memberships.error) throw new Error("Could not read categories.");
  const enabledIds = new Set(catalog.map((model) => model.id));
  const categoryCounts = new Map<string, number>();
  for (const link of memberships.data ?? []) {
    if (!enabledIds.has(link.model_id as string)) continue;
    categoryCounts.set(link.category_id as string, (categoryCounts.get(link.category_id as string) ?? 0) + 1);
  }
  const categories = categoryEntries
    .map((row) => ({ id: row.id, name: row.name, description: row.description, icon: row.icon, models: categoryCounts.get(row.id) ?? 0 }))
    .filter((row) => row.models >= 2);
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
      const categoryId = mode === "class" && typeof row.pool_key === "string" ? row.pool_key : null;
      return [{ id, mode, difficulty: difficultyFromStored(row.difficulty), companyId, categoryId }];
    }),
    dailyFinished: (dailyToday ?? []).flatMap((row) => {
      if (row.status === "active") return [];
      const level = difficultyFromStored(row.difficulty);
      return level ? [level] : [];
    }),
    poolSize: catalog.length,
    difficultyCounts: difficultyCounts(catalog),
    companies,
    categories,
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

/** One category. Enabled models in it only. No difficulty. Same hints as Company. */
export async function startCategory(userId: string, categoryId: string, noHint = false): Promise<{ gameId: string } | ApiFailure> {
  const id = parseCategoryId(categoryId);
  if (!id) return fail(422, "category");
  const client = serviceOrThrow();
  const [{ data: gameMode, error }, { data: category, error: categoryError }, { data: links, error: linkError }, catalog] =
    await Promise.all([
      client.from("game_modes").select("id, enabled, hints_allowed").eq("id", "class").maybeSingle(),
      client.from("categories").select("id").eq("id", id).maybeSingle(),
      client.from("model_categories").select("model_id").eq("category_id", id),
      loadCatalog(client),
    ]);
  if (error) throw new Error(error.message);
  if (categoryError) throw new Error(categoryError.message);
  if (linkError) throw new Error(linkError.message);
  if (!gameMode?.enabled || !category) return fail(404, "not_found");
  const members = new Set((links ?? []).map((link) => link.model_id as string));
  const pool = catalog.filter((model) => members.has(model.id));
  const modelId = pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
  if (pool.length < 2 || !modelId) return fail(422, "pool_too_small");
  const result = await rpc(client, "start_game", {
    p_user_id: userId,
    p_hourly_cap: config.hourlyCap,
    p_game_mode: "class",
    p_pool_key: id,
    p_no_hint: noHint,
    p_model_id: modelId,
    p_pool_model_ids: pool.map((model) => model.id),
    p_traits: buildTraits(pool),
    p_rules: rulesForGameMode(Boolean(gameMode.hints_allowed) && gameModeAllowsHints("class")),
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
