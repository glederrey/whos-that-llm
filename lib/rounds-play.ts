import { difficultyFromStored } from "./difficulty";
import {
  compareModel,
  eliminatedCompanyIds,
  eliminatedOrigins,
  filterCandidates,
  hintAllowedForMode,
  hintOffered,
  knownValues,
  playableHints,
  originChoices,
  toPublicGame,
  type PublicGame,
  type ScoreLine,
} from "./game";
import { roundContext } from "./prompt";
import { serviceOrThrow } from "./rounds-db";
import { loadGame, readUsage, rowWithTraits, rpc, scoreFrom, withCatalogLogos } from "./rounds-queries";
import { loadCatalogCached } from "./rounds-start";
import { guessFinish } from "./rounds-score";
import {
  fail,
  fromRpc,
  guessFlags,
  previousGuesses,
  recordedGuesses,
  type GameRow,
  sortTranscript,
  type ApiFailure,
} from "./rounds-shape";

export async function readPublicGame(gameId: string, userId: string): Promise<PublicGame | null> {
  const client = serviceOrThrow();
  // The current logos come from the cached catalog, in the same batch, instead of a read after the game row.
  const [{ data: row, error }, { data: messages }, { data: guesses }, catalog] = await Promise.all([
    client.from("games").select("*").eq("id", gameId).eq("user_id", userId).maybeSingle(),
    client.from("messages").select("turn, role, content").eq("game_id", gameId).order("turn").order("role"),
    client
      .from("guesses")
      .select("turn, guessed_model_id, guessed_origin, model_correct, company_correct, origin_correct")
      .eq("game_id", gameId)
      .order("turn"),
    loadCatalogCached(),
  ]);
  if (error) throw new Error(error.message);
  const loaded = await rowWithTraits(client, (row as GameRow | null) ?? null, false);
  if (!loaded) return null;
  const game = { ...loaded, traits: withCatalogLogos(loaded.traits, catalog) };
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
    traits: game.traits,
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
  // The transcript only needs the game id. A round that is not the player's is dropped below, with the messages unused.
  const [game, { data: messages }] = await Promise.all([
    loadGame(client, gameId, userId, { logos: false }),
    client.from("messages").select("turn, role, content").eq("game_id", gameId).order("turn"),
  ]);
  if (!game) return null;
  const [{ data, error }, categoryName] = await Promise.all([
    client.from("models").select("openrouter_id, provider_settings, reasoning").eq("id", game.model_id).single(),
    game.game_mode === "class" && typeof game.pool_key === "string" ? readCategoryName(client, game.pool_key) : Promise.resolve(null),
  ]);
  if (error) throw new Error(error.message);
  const pool = Object.values(game.traits.models);
  return {
    game,
    context: roundContext({
      gameMode: game.game_mode,
      poolSize: pool.length,
      companyName: pool.find((model) => model.companyId === game.pool_key)?.companyName ?? null,
      categoryName,
    }),
    openrouterId: data.openrouter_id as string,
    providerSettings: data.provider_settings,
    reasoning: Boolean(data.reasoning),
    transcript: sortTranscript(messages ?? []).map(({ role, content }) => ({ role, content })),
  };
}

async function readCategoryName(client: ReturnType<typeof serviceOrThrow>, id: string): Promise<string | null> {
  const { data } = await client.from("categories").select("name").eq("id", id).maybeSingle();
  return (data?.name as string | undefined) ?? null;
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
  // The usage read is only used when this guess ends the round, but it needs nothing from the game row,
  // so it runs beside the other two instead of after them.
  const [game, { data: guesses }, usage] = await Promise.all([
    loadGame(client, gameId, userId, { logos: false }),
    client
      .from("guesses")
      .select("guessed_model_id, guessed_origin, model_correct, company_correct, origin_correct")
      .eq("game_id", gameId),
    readUsage(client, gameId),
  ]);
  if (!game) return fail(404, "not_found");
  if (!game.awaiting_guess || game.status !== "active") return fail(409, "turn");

  const previous = previousGuesses(guesses ?? []);
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
      eliminatedOrigins(game.traits, previous, game.no_hint),
    ).map((row) => row.id),
  );
  if (!allowed.has(modelId)) return fail(409, "conflict");

  const flags = compareModel(game.model_id, modelId, hidden, guessed);
  const all = [...previous, flags];
  const finish = guessFinish(flags.modelCorrect, game.message_count, game.rules.messageLimit);
  let score: number | null = null;
  let breakdown: ScoreLine[] | null = null;
  let explanation: string[] | null = null;
  if (finish !== "continue") {
    const scored = await scoreFrom(client, game, all, finish === "solved", usage);
    score = scored.score;
    breakdown = scored.breakdown;
    explanation = scored.explanation;
  }

  return fromRpc(
    await rpc(client, "apply_guess", {
      p_game_id: gameId,
      p_user_id: userId,
      p_model_id: modelId,
      p_origin: guessed.origin,
      p_model_correct: flags.modelCorrect,
      p_company_correct: flags.companyCorrect,
      p_origin_correct: flags.originCorrect,
      p_finish: finish,
      p_score: score,
      p_breakdown: breakdown,
      p_explanation: explanation,
    }),
  );
}

/** Origin guess: one origin. Right ends the round solved, wrong ends it missed. No score. */
export async function submitOriginGuess(gameId: string, userId: string, origin: string): Promise<ApiFailure | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId, { logos: false });
  if (!game) return fail(404, "not_found");
  if (game.game_mode !== "origin" || !game.awaiting_guess || game.status !== "active") return fail(409, "turn");
  const hidden = game.traits.models[game.model_id];
  if (!hidden) return fail(409, "conflict");
  if (!originChoices(game.traits).some((choice) => choice.id === origin)) return fail(409, "conflict");
  return fromRpc(
    await rpc(client, "apply_origin_guess", {
      p_game_id: gameId,
      p_user_id: userId,
      p_origin: origin,
      p_correct: hidden.origin === origin,
    }),
  );
}

export async function buyHint(gameId: string, userId: string, key: string): Promise<ApiFailure | null> {
  const hint = playableHints([key])[0];
  if (!hint) return fail(422, "hint");
  const client = serviceOrThrow();
  const [game, { data: guesses }] = await Promise.all([
    loadGame(client, gameId, userId, { logos: false }),
    client.from("guesses").select("model_correct, company_correct, origin_correct").eq("game_id", gameId),
  ]);
  if (!game) return fail(404, "not_found");
  if (!hintAllowedForMode(game.game_mode, hint)) return fail(422, "hint");
  const hidden = game.traits.models[game.model_id];
  if (!hidden) return fail(409, "conflict");
  const flags = guessFlags(guesses ?? []);
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
  // The guesses and the usage only need the game id, so they are read beside the game row. They are
  // used only when the round has a score to compute.
  const [game, { data: guesses }, usage] = await Promise.all([
    loadGame(client, gameId, userId, { logos: false }),
    client.from("guesses").select("model_correct, company_correct, origin_correct").eq("game_id", gameId),
    readUsage(client, gameId),
  ]);
  if (!game) return fail(404, "not_found");
  if (game.status !== "active") return fail(409, "turn");
  let score: number | null = null;
  let breakdown: ScoreLine[] | null = null;
  let explanation: string[] | null = null;
  if (game.message_count >= 1 && game.game_mode !== "origin") {
    const scored = await scoreFrom(client, game, guessFlags(guesses ?? []), false, usage);
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
