import type { SupabaseClient } from "@supabase/supabase-js";
import { config, currentRules, rulesForGameMode, type Rules } from "./config";
import { boardSince } from "./board-query";
import { dailyRoundKey, startDailyRound, utcDayKey, type DailyRound } from "./daily";
import { difficulties, difficultyFromStored, difficultyNumber, inDifficultyPool, type BoardDifficulty, type Difficulty } from "./difficulty";
import {
  buildTraits,
  compareModel,
  eliminatedCompanyIds,
  eliminatedRegions,
  filterCandidates,
  gameModeAllowsHints,
  hintOffered,
  playableHints,
  knownValues,
  scoreRound,
  scoreTokens,
  toPublicGame,
  type FrozenModel,
  type GameStatus,
  type GuessFlags,
  type HintKey,
  type PublicGame,
  type RecordedGuess,
  type ScoreLine,
  type TraitKey,
  type Traits,
} from "./game";
import { logoPathForPlay, logoPublicUrl } from "./logos";
import { countedPlayerId } from "./anonymize-account";
import { avatarPublicUrl, cleanUsername } from "./profile";
import { publicEnv } from "./supabase/env";
import { createServiceClient, createSessionClient } from "./supabase/server";

type GameRow = {
  id: string;
  user_id: string;
  username: string;
  game_mode: string;
  pool_key: string | null;
  pool_model_ids: string[];
  model_id: string;
  traits: Traits;
  status: GameStatus;
  no_hint: boolean;
  rules: Rules;
  hints: HintKey[];
  difficulty: number | string | null;
  message_count: number;
  awaiting_guess: boolean;
  score: number | null;
  score_breakdown: ScoreLine[] | null;
  score_explanation: string[] | null;
};

type RpcResult = { ok: boolean; error?: string; gameId?: string; nextAt?: string };

export type ApiFailure = { status: number; error: string; nextAt?: string; paused?: boolean };

export function serviceOrThrow() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase server env is missing.");
  return client;
}

function fail(status: number, error: string, extra: Partial<ApiFailure> = {}): ApiFailure {
  return { status, error, ...extra };
}

function fromRpc(result: RpcResult): ApiFailure | null {
  if (result.ok) return null;
  if (result.error === "paused") return fail(503, "paused");
  if (result.error === "not_found") return fail(404, "not_found");
  if (result.error === "username") return fail(422, "username");
  if (result.error === "active_game") return fail(409, "active_game");
  if (result.error === "daily_done") return fail(409, "daily_done");
  if (result.error === "hourly_cap") return fail(429, "hourly_cap", { nextAt: result.nextAt });
  if (result.error === "conflict") return fail(409, "conflict");
  if (result.error === "hint") return fail(422, "hint");
  return fail(409, "turn");
}

async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as RpcResult;
}

type CatalogModel = FrozenModel & { id: string; openrouterId: string; providerSettings: unknown; difficulty: Difficulty };

const catalogColumns =
  "id, name, company_id, size, released_on, enabled, difficulty, logo_path, openrouter_id, provider_settings, companies(name, region, logo_path)";

function mapCatalog(data: readonly object[]): CatalogModel[] {
  return data.flatMap((row) => {
    const record = row as {
      id: string;
      name: string;
      company_id: string;
      size: FrozenModel["size"];
      released_on: string | null;
      difficulty: unknown;
      logo_path: string | null;
      openrouter_id: string;
      provider_settings: unknown;
      companies: { name: string; region: FrozenModel["region"]; logo_path: string } | Array<{ name: string; region: FrozenModel["region"]; logo_path: string }> | null;
    };
    const difficulty = difficultyFromStored(record.difficulty);
    if (!difficulty || typeof record.released_on !== "string") return [];
    const company = first(record.companies);
    if (!company) return [];
    return [{
      id: record.id,
      name: record.name,
      companyId: record.company_id,
      companyName: company.name,
      region: company.region,
      size: record.size,
      year: new Date(`${record.released_on}T00:00:00Z`).getUTCFullYear(),
      logoPath: presentLogo(record.logo_path || company.logo_path, record.company_id),
      openrouterId: record.openrouter_id,
      providerSettings: record.provider_settings,
      difficulty,
    }];
  });
}

async function loadCatalog(client: SupabaseClient, maxDifficulty?: Difficulty): Promise<CatalogModel[]> {
  let query = client.from("models").select(catalogColumns).eq("enabled", true);
  if (maxDifficulty) query = query.lte("difficulty", difficultyNumber[maxDifficulty]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapCatalog(data ?? []);
}

async function loadModel(client: SupabaseClient, id: string): Promise<CatalogModel | null> {
  const { data, error } = await client.from("models").select(catalogColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return mapCatalog(data ? [data] : [])[0] ?? null;
}

export function difficultyCounts(models: Array<{ difficulty: Difficulty }>): Record<Difficulty, number> {
  const counts = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  for (const game of difficulties) {
    counts[game] = models.filter((model) => inDifficultyPool(model.difficulty, game)).length;
  }
  return counts;
}

function first<T>(value: T | T[] | null): T {
  if (Array.isArray(value)) return value[0] as T;
  return value as T;
}

export function presentLogo(path: string, companyId: string): string {
  const stored = logoPathForPlay(path, companyId);
  const base = publicEnv()?.url;
  if (!base) return stored;
  return logoPublicUrl(base, stored);
}

const keptTraits = new Set<TraitKey>(["company", "region", "year", "size"]);

function presentTraits(traits: Traits): Traits {
  const models: Traits["models"] = {};
  for (const [id, model] of Object.entries(traits.models)) {
    models[id] = {
      name: model.name,
      companyId: model.companyId,
      companyName: model.companyName,
      region: model.region,
      size: model.size,
      year: model.year,
      logoPath: presentLogo(model.logoPath, model.companyId),
    };
  }
  return {
    given: traits.given.filter((key): key is TraitKey => keptTraits.has(key as TraitKey)),
    models,
  };
}

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
    client.from("companies").select("id, name").order("name"),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (companies.error) throw new Error(companies.error.message);
  return {
    categories: (categories.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
    companies: (companies.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
  };
}

export async function lobbyState(userId: string) {
  const client = serviceOrThrow();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const day = utcDayKey();
  const [{ data: settings }, { count }, { data: active }, { data: dailyToday }, catalog] = await Promise.all([
    client.from("app_settings").select("paused").eq("id", 1).single(),
    client.from("games").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("started_at", since),
    client.from("games").select("id, game_mode, difficulty").eq("user_id", userId).eq("status", "active").maybeSingle(),
    client.from("games").select("status, difficulty").eq("user_id", userId).eq("game_mode", "daily").like("daily_key", `${day}:%`),
    loadCatalog(client),
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
  return {
    paused: Boolean(settings?.paused),
    played: count ?? 0,
    cap: config.hourlyCap,
    activeGameId: (active?.id as string | undefined) ?? null,
    activeGameMode: (active?.game_mode as string | undefined) ?? null,
    activeGameDifficulty: difficultyFromStored(active?.difficulty),
    dailyFinished: (dailyToday ?? []).flatMap((row) => {
      if (row.status === "active") return [];
      const level = difficultyFromStored(row.difficulty);
      return level ? [level] : [];
    }),
    poolSize: catalog.length,
    difficultyCounts: difficultyCounts(catalog),
    nextAt,
  };
}

export function startAllModels(userId: string, noHint: boolean, difficulty: Difficulty) {
  return startRosterRound(userId, "all", noHint, difficulty);
}

export function startDaily(userId: string, noHint: boolean, difficulty: Difficulty) {
  return startRosterRound(userId, "daily", noHint, difficulty);
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

async function loadGame(client: SupabaseClient, gameId: string, userId: string): Promise<GameRow | null> {
  const { data, error } = await client.from("games").select("*").eq("id", gameId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const game = (data as GameRow | null) ?? null;
  return game ? { ...game, traits: presentTraits(game.traits), rules: currentRules(game.rules), hints: playableHints(game.hints) } : null;
}

export async function readPublicGame(gameId: string, userId: string): Promise<PublicGame | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return null;
  const [{ data: messages }, { data: guesses }] = await Promise.all([
    client.from("messages").select("turn, role, content").eq("game_id", gameId).order("turn").order("role"),
    client
      .from("guesses")
      .select("turn, guessed_model_id, guessed_region, model_correct, company_correct, region_correct")
      .eq("game_id", gameId)
      .order("turn"),
  ]);
  const recorded = recordedGuesses(guesses ?? []);
  const guessedModelIds = recorded
    .map((guess) => guess.modelId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return toPublicGame({
    id: game.id,
    gameMode: game.game_mode,
    poolKey: game.pool_key,
    difficulty: difficultyFromStored(game.difficulty),
    noHint: game.no_hint,
    status: game.status,
    messageCount: game.message_count,
    awaitingGuess: game.awaiting_guess,
    rules: game.rules,
    traits: presentTraits(game.traits),
    modelId: game.model_id,
    hints: game.hints ?? [],
    guesses: recorded,
    guessedModelIds,
    transcript: sortTranscript(messages ?? []),
    score: game.score,
    breakdown: game.score_breakdown,
    explanation: game.score_explanation,
  });
}

export async function hiddenCall(gameId: string, userId: string) {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return null;
  const { data, error } = await client
    .from("models")
    .select("openrouter_id, provider_settings")
    .eq("id", game.model_id)
    .single();
  if (error) throw new Error(error.message);
  const { data: messages } = await client
    .from("messages")
    .select("turn, role, content")
    .eq("game_id", gameId)
    .order("turn");
  return {
    game,
    openrouterId: data.openrouter_id as string,
    providerSettings: data.provider_settings,
    transcript: sortTranscript(messages ?? []).map(({ role, content }) => ({ role, content })),
  };
}

export async function claimCall(gameId: string, userId: string) {
  const client = serviceOrThrow();
  return fromRpc(await rpc(client, "claim_model_call", { p_game_id: gameId, p_user_id: userId }));
}

export async function saveReply(
  gameId: string,
  userId: string,
  userText: string,
  assistantText: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    generationId: string | null;
  },
) {
  const client = serviceOrThrow();
  return fromRpc(
    await rpc(client, "apply_reply", {
      p_game_id: gameId,
      p_user_id: userId,
      p_user_text: userText,
      p_assistant_text: assistantText,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_reasoning_tokens: usage.reasoningTokens,
      p_cache_read_tokens: usage.cacheReadTokens,
      p_cost_usd: usage.costUsd,
      p_generation_id: usage.generationId,
    }),
  );
}

export async function abortReply(gameId: string, userId: string, pause: boolean) {
  const client = serviceOrThrow();
  await rpc(client, "abort_reply", {
    p_game_id: gameId,
    p_user_id: userId,
    p_error_code: pause ? "credit" : "upstream",
    p_pause: pause,
  });
}

export async function submitGuess(gameId: string, userId: string, modelId: string): Promise<ApiFailure | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return fail(404, "not_found");
  if (!game.awaiting_guess || game.status !== "active") return fail(409, "turn");

  const { data: guesses } = await client
    .from("guesses")
    .select("guessed_model_id, guessed_region, model_correct, company_correct, region_correct")
    .eq("game_id", gameId);
  const previous = (guesses ?? []).map((guess) => ({
    modelId: guess.guessed_model_id,
    region: guess.guessed_region,
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    regionCorrect: Boolean(guess.region_correct),
  }));
  const guessedModelIds = previous
    .map((guess) => guess.modelId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const hidden = game.traits.models[game.model_id];
  const guessed = game.traits.models[modelId];
  if (!hidden || !guessed) return fail(409, "conflict");

  const known = knownValues({
    traits: game.traits,
    hidden,
    guesses: previous,
    hints: game.hints ?? [],
    noHint: game.no_hint,
  });
  const allowed = new Set(
    filterCandidates(
      game.traits,
      known,
      guessedModelIds,
      eliminatedCompanyIds(game.traits, previous, game.no_hint),
      eliminatedRegions(game.traits, previous, game.no_hint),
    ).map((row) => row.id),
  );
  if (!allowed.has(modelId)) return fail(409, "conflict");

  const flags = compareModel(game.model_id, modelId, hidden, guessed);
  const all = [...previous, flags];
  const finish: "continue" | "solved" | "miss" = flags.modelCorrect
    ? "solved"
    : game.message_count >= game.rules.messageLimit
      ? "miss"
      : "continue";
  let score: number | null = null;
  let breakdown: ScoreLine[] | null = null;
  let explanation: string[] | null = null;
  if (finish !== "continue") {
    const scored = await scoreFrom(client, game, all, finish === "solved");
    score = scored.score;
    breakdown = scored.breakdown;
    explanation = scored.explanation;
  }

  return fromRpc(
    await rpc(client, "apply_guess", {
      p_game_id: gameId,
      p_user_id: userId,
      p_model_id: modelId,
      p_region: guessed.region,
      p_model_correct: flags.modelCorrect,
      p_company_correct: flags.companyCorrect,
      p_region_correct: flags.regionCorrect,
      p_finish: finish,
      p_score: score,
      p_breakdown: breakdown,
      p_explanation: explanation,
    }),
  );
}

export async function buyHint(gameId: string, userId: string, key: string): Promise<ApiFailure | null> {
  const hint = playableHints([key])[0];
  if (!hint) return fail(422, "hint");
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return fail(404, "not_found");
  const hidden = game.traits.models[game.model_id];
  if (!hidden) return fail(409, "conflict");
  const { data: guesses } = await client
    .from("guesses")
    .select("model_correct, company_correct, region_correct")
    .eq("game_id", gameId);
  const flags: GuessFlags[] = (guesses ?? []).map((guess) => ({
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    regionCorrect: Boolean(guess.region_correct),
  }));
  const offered = hintOffered({
    key: hint,
    traits: game.traits,
    hidden,
    guesses: flags,
    hints: game.hints ?? [],
    noHint: game.no_hint,
  });
  if (!offered) return fail(422, "hint");
  return fromRpc(await rpc(client, "apply_hint", { p_game_id: gameId, p_user_id: userId, p_key: hint }));
}

export async function giveUp(gameId: string, userId: string): Promise<ApiFailure | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return fail(404, "not_found");
  if (game.status !== "active") return fail(409, "turn");
  let score: number | null = null;
  let breakdown: ScoreLine[] | null = null;
  let explanation: string[] | null = null;
  if (game.message_count >= 1) {
    const { data: guesses } = await client
      .from("guesses")
      .select("model_correct, company_correct, region_correct")
      .eq("game_id", gameId);
    const flags: GuessFlags[] = (guesses ?? []).map((guess) => ({
      modelCorrect: Boolean(guess.model_correct),
      companyCorrect: Boolean(guess.company_correct),
      regionCorrect: Boolean(guess.region_correct),
    }));
    const scored = await scoreFrom(client, game, flags, false);
    score = scored.score;
    breakdown = scored.breakdown;
    explanation = scored.explanation;
  }
  return fromRpc(
    await rpc(client, "apply_give_up", {
      p_game_id: gameId,
      p_user_id: userId,
      p_score: score,
      p_breakdown: breakdown,
      p_explanation: explanation,
    }),
  );
}

async function scoreFrom(client: SupabaseClient, game: GameRow, guesses: GuessFlags[], namedModel: boolean) {
  const { data } = await client
    .from("usage")
    .select("input_tokens, output_tokens")
    .eq("game_id", game.id)
    .is("error_code", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  const tokens = scoreTokens(
    (data ?? []).map((row) => ({
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
    })),
  ).tokens;
  return scoreRound({
    rules: game.rules,
    namedModel,
    regionMatched: guesses.some((guess) => guess.regionCorrect),
    companyMatched: guesses.some((guess) => guess.companyCorrect),
    regionGiven: game.traits.given.includes("region"),
    companyGiven: game.traits.given.includes("company"),
    tokens,
    noHint: game.no_hint,
    hints: game.hints ?? [],
    wrongGuesses: guesses.filter((guess) => !guess.modelCorrect).length,
    difficulty: difficultyFromStored(game.difficulty),
  });
}

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  mine: boolean;
  avatarUrl: string | null;
  seed: string;
  difficulty: Difficulty | null;
  noHint: boolean;
};

type BoardEntry = {
  rank: number;
  name: string;
  score: number;
  mine?: boolean;
  user_id?: string | null;
  avatar_path?: string | null;
  difficulty?: number | string | null;
  no_hint?: boolean | null;
};

function toBoardRow(entry: BoardEntry, mine: boolean): BoardRow {
  const userId = typeof entry.user_id === "string" ? entry.user_id : "";
  return {
    rank: Number(entry.rank),
    name: entry.name,
    score: Number(entry.score),
    mine,
    avatarUrl: avatarPublicUrl(publicEnv()?.url ?? "", entry.avatar_path ?? null),
    seed: userId || entry.name,
    difficulty: difficultyFromStored(entry.difficulty),
    noHint: Boolean(entry.no_hint),
  };
}

export async function leaderboard(
  gameMode: string,
  period: string,
  viewerId?: string | null,
  difficulty?: BoardDifficulty | null,
) {
  const client = serviceOrThrow();
  const { data: row } = await client.from("game_modes").select("leaderboard").eq("id", gameMode).maybeSingle();
  if (!row?.leaderboard) return fail(404, "not_found");
  const since = boardSince(period === "month" || period === "all" ? period : "week");
  const fresh = await client.rpc("leaderboard", {
    game_mode: gameMode,
    since,
    viewer: viewerId ?? null,
    p_difficulty: difficulty && difficulty !== "any" ? difficultyNumber[difficulty] : null,
  });
  if (!fresh.error) {
    const rows = ((fresh.data ?? []) as BoardEntry[]).map((entry) => toBoardRow(entry, Boolean(entry.mine)));
    return { rows };
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
    const row = games?.[0];
    if (row && typeof row.score === "number") best = { username: row.username as string, score: row.score };
  }
  return data.map((entry) =>
    toBoardRow(entry, Boolean(best && entry.name === best.username && Number(entry.score) === best.score)),
  );
}

export async function landingSnapshot() {
  const client = serviceOrThrow();
  return readPublicStats(client);
}

async function readPublicStats(client: SupabaseClient) {
  const { data, error } = await client.rpc("public_stats");
  if (!error && data && typeof data === "object") {
    const stats = data as { models?: number; gamesToday?: number; players?: number };
    return {
      models: Number(stats.models ?? 0),
      gamesToday: Number(stats.gamesToday ?? 0),
      players: Number(stats.players ?? 0),
    };
  }
  const midnight = new Date();
  const startDate = new Date(Date.UTC(midnight.getUTCFullYear(), midnight.getUTCMonth(), midnight.getUTCDate()));
  const start = startDate.toISOString();
  const end = new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const [models, gamesToday, players] = await Promise.all([
    client.from("models").select("id", { count: "exact", head: true }).eq("enabled", true),
    client
      .from("games")
      .select("id", { count: "exact", head: true })
      .gte("finished_at", start)
      .lt("finished_at", end),
    countPlayers(client),
  ]);
  if (models.error) throw new Error(models.error.message);
  if (gamesToday.error) throw new Error(gamesToday.error.message);
  return { models: models.count ?? 0, gamesToday: gamesToday.count ?? 0, players };
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

function recordedGuesses(
  rows: {
    turn?: number;
    guessed_model_id: string | null;
    guessed_region?: string | null;
    model_correct: boolean;
    company_correct: boolean;
    region_correct: boolean;
  }[],
): RecordedGuess[] {
  return rows.map((guess) => ({
    turn: guess.turn ?? 0,
    modelId: guess.guessed_model_id,
    region:
      guess.guessed_region === "us" || guess.guessed_region === "cn" || guess.guessed_region === "eu"
        ? guess.guessed_region
        : null,
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    regionCorrect: Boolean(guess.region_correct),
  }));
}

function sortTranscript(
  rows: { turn: number; role: string; content: string }[],
): { turn: number; role: "user" | "assistant"; content: string }[] {
  return [...rows]
    .sort((a, b) => a.turn - b.turn || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1))
    .map((message) => ({
      turn: message.turn,
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

export async function setUsername(userId: string, raw: string): Promise<ApiFailure | null> {
  if (!cleanUsername(raw)) return fail(422, "username");
  const session = await createSessionClient();
  if (!session) return fail(401, "unauthorized");
  const { data: userData } = await session.auth.getUser();
  if (!userData.user || userData.user.id !== userId) return fail(401, "unauthorized");
  const { data, error } = await session.rpc("set_username", { p_username: raw });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    if (result?.error === "unauthorized") return fail(401, "unauthorized");
    return fail(422, "username");
  }
  return null;
}
