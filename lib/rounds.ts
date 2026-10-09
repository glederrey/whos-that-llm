import type { SupabaseClient } from "@supabase/supabase-js";
import { config, rulesForCategory, type Rules } from "./config";
import {
  buildTraits,
  compareModel,
  filterCandidates,
  knownValues,
  scoreRound,
  toPublicGame,
  type FrozenModel,
  type GameStatus,
  type GuessFlags,
  type HintKey,
  type PublicGame,
  type ScoreLine,
  type Traits,
} from "./game";
import { createServiceClient, createSessionClient } from "./supabase/server";

type GameRow = {
  id: string;
  user_id: string;
  username: string;
  category: string;
  pool_key: string | null;
  pool_model_ids: string[];
  model_id: string;
  traits: Traits;
  status: GameStatus;
  no_hint: boolean;
  rules: Rules;
  hints: HintKey[];
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

type CatalogModel = FrozenModel & { id: string; openrouterId: string; providerSettings: unknown };

async function loadCatalog(client: SupabaseClient): Promise<CatalogModel[]> {
  const { data, error } = await client
    .from("models")
    .select(
      "id, name, company_id, family_id, size, released_on, enabled, logo_path, openrouter_id, provider_settings, companies(name, region, logo_path), families(name)",
    )
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const company = first(row.companies) as { name: string; region: FrozenModel["region"]; logo_path: string };
    const family = first(row.families) as { name: string };
    return {
      id: row.id as string,
      name: row.name as string,
      companyId: row.company_id as string,
      companyName: company.name,
      familyId: row.family_id as string,
      familyName: family.name,
      region: company.region,
      size: row.size as FrozenModel["size"],
      year: new Date(`${row.released_on}T00:00:00Z`).getUTCFullYear(),
      logoPath: (row.logo_path as string | null) || company.logo_path,
      openrouterId: row.openrouter_id as string,
      providerSettings: row.provider_settings,
    };
  });
}

function first<T>(value: T | T[] | null): T {
  if (Array.isArray(value)) return value[0] as T;
  return value as T;
}

export async function listCategories() {
  const client = serviceOrThrow();
  const { data, error } = await client
    .from("categories")
    .select("id, name, blurb, enabled, sort_order, leaderboard")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function lobbyState(userId: string) {
  const client = serviceOrThrow();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: settings }, { count }, { data: active }, catalog] = await Promise.all([
    client.from("app_settings").select("paused").eq("id", 1).single(),
    client.from("games").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("started_at", since),
    client.from("games").select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
    loadCatalog(client),
  ]);
  let nextAt: string | null = null;
  if ((count ?? 0) >= config.hourlyCap) {
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
    poolSize: catalog.length,
    nextAt,
  };
}

export async function startAllModels(userId: string, noHint: boolean): Promise<{ gameId: string } | ApiFailure> {
  const client = serviceOrThrow();
  const { data: category, error } = await client
    .from("categories")
    .select("id, enabled, hints_allowed")
    .eq("id", "all")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!category?.enabled) return fail(404, "not_found");

  const catalog = await loadCatalog(client);
  if (catalog.length < 2) return fail(422, "pool_too_small");
  const drawn = catalog[Math.floor(Math.random() * catalog.length)];
  if (!drawn) return fail(422, "pool_too_small");
  const traits = buildTraits(catalog);
  const result = await rpc(client, "start_game", {
    p_user_id: userId,
    p_hourly_cap: config.hourlyCap,
    p_category: "all",
    p_pool_key: null,
    p_no_hint: noHint,
    p_model_id: drawn.id,
    p_pool_model_ids: catalog.map((model) => model.id),
    p_traits: traits,
    p_rules: rulesForCategory(Boolean(category.hints_allowed)),
  });
  const failure = fromRpc(result);
  if (failure) return failure;
  return { gameId: result.gameId as string };
}

async function loadGame(client: SupabaseClient, gameId: string, userId: string): Promise<GameRow | null> {
  const { data, error } = await client.from("games").select("*").eq("id", gameId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GameRow | null) ?? null;
}

export async function readPublicGame(gameId: string, userId: string): Promise<PublicGame | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return null;
  const [{ data: messages }, { data: guesses }] = await Promise.all([
    client.from("messages").select("turn, role, content").eq("game_id", gameId).order("turn").order("role"),
    client.from("guesses").select("guessed_model_id, model_correct, company_correct, family_correct, region_correct").eq("game_id", gameId),
  ]);
  const flags: GuessFlags[] = (guesses ?? []).map((guess) => ({
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    familyCorrect: Boolean(guess.family_correct),
    regionCorrect: Boolean(guess.region_correct),
  }));
  const guessedModelIds = (guesses ?? [])
    .map((guess) => guess.guessed_model_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return toPublicGame({
    id: game.id,
    category: game.category,
    poolKey: game.pool_key,
    noHint: game.no_hint,
    status: game.status,
    messageCount: game.message_count,
    awaitingGuess: game.awaiting_guess,
    rules: game.rules,
    traits: game.traits,
    modelId: game.model_id,
    hints: game.hints ?? [],
    guesses: flags,
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
    .select("guessed_model_id, model_correct, company_correct, family_correct, region_correct")
    .eq("game_id", gameId);
  const previous: GuessFlags[] = (guesses ?? []).map((guess) => ({
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    familyCorrect: Boolean(guess.family_correct),
    regionCorrect: Boolean(guess.region_correct),
  }));
  const guessedModelIds = (guesses ?? [])
    .map((guess) => guess.guessed_model_id)
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
  const allowed = new Set(filterCandidates(game.traits, known, guessedModelIds).map((row) => row.id));
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
      p_family_correct: flags.familyCorrect,
      p_region_correct: flags.regionCorrect,
      p_finish: finish,
      p_score: score,
      p_breakdown: breakdown,
      p_explanation: explanation,
    }),
  );
}

export async function buyHint(gameId: string, userId: string, key: string): Promise<ApiFailure | null> {
  if (key !== "year" && key !== "size") return fail(422, "hint");
  const client = serviceOrThrow();
  return fromRpc(await rpc(client, "apply_hint", { p_game_id: gameId, p_user_id: userId, p_key: key }));
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
      .select("company_correct, region_correct")
      .eq("game_id", gameId);
    const flags: GuessFlags[] = (guesses ?? []).map((guess) => ({
      modelCorrect: false,
      companyCorrect: Boolean(guess.company_correct),
      familyCorrect: false,
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
    .is("error_code", null);
  const tokens = (data ?? []).reduce(
    (sum, row) => sum + Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0),
    0,
  );
  return scoreRound({
    rules: game.rules,
    namedModel,
    regionMatched: guesses.some((guess) => guess.regionCorrect),
    companyMatched: guesses.some((guess) => guess.companyCorrect),
    regionGiven: game.traits.given.includes("region"),
    companyGiven: game.traits.given.includes("company"),
    tokens,
    messages: game.message_count,
    noHint: game.no_hint,
    hints: game.hints ?? [],
  });
}

export async function leaderboard(category: string, period: string) {
  const client = serviceOrThrow();
  const { data: row } = await client.from("categories").select("leaderboard").eq("id", category).maybeSingle();
  if (!row?.leaderboard) return fail(404, "not_found");
  const since = period === "week" ? mondayUtc() : "1970-01-01T00:00:00.000Z";
  const { data, error } = await client.rpc("leaderboard", { category, since });
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as { rank: number; name: string; score: number }[] };
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

function mondayUtc() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString();
}

export async function setUsername(userId: string, raw: string): Promise<ApiFailure | null> {
  const username = raw.trim();
  if (username.length < 3 || username.length > 20 || /[\n\r]/.test(username)) return fail(422, "username");
  const session = await createSessionClient();
  if (!session) return fail(401, "unauthorized");
  const { data, error } = await session
    .from("profiles")
    .update({ username })
    .eq("id", userId)
    .is("username", null)
    .select("username")
    .maybeSingle();
  if (error) return fail(422, "username");
  if (!data) return fail(422, "username");
  return null;
}
