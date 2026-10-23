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
import { serviceOrThrow } from "./rounds-db";
import { loadGame, rpc, scoreFrom } from "./rounds-queries";
import { guessFinish } from "./rounds-score";
import {
  fail,
  fromRpc,
  guessFlags,
  presentTraits,
  previousGuesses,
  recordedGuesses,
  sortTranscript,
  type ApiFailure,
} from "./rounds-shape";

export async function readPublicGame(gameId: string, userId: string): Promise<PublicGame | null> {
  const client = serviceOrThrow();
  const game = await loadGame(client, gameId, userId);
  if (!game) return null;
  const [{ data: messages }, { data: guesses }] = await Promise.all([
    client.from("messages").select("turn, role, content").eq("game_id", gameId).order("turn").order("role"),
    client
      .from("guesses")
      .select("turn, guessed_model_id, guessed_origin, model_correct, company_correct, origin_correct")
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
    .select("openrouter_id, provider_settings, reasoning")
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
    reasoning: Boolean(data.reasoning),
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
    .select("guessed_model_id, guessed_origin, model_correct, company_correct, origin_correct")
    .eq("game_id", gameId);
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
  const game = await loadGame(client, gameId, userId);
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
  const game = await loadGame(client, gameId, userId);
  if (!game) return fail(404, "not_found");
  if (!hintAllowedForMode(game.game_mode, hint)) return fail(422, "hint");
  const hidden = game.traits.models[game.model_id];
  if (!hidden) return fail(409, "conflict");
  const { data: guesses } = await client
    .from("guesses")
    .select("model_correct, company_correct, origin_correct")
    .eq("game_id", gameId);
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
  const game = await loadGame(client, gameId, userId);
  if (!game) return fail(404, "not_found");
  if (game.status !== "active") return fail(409, "turn");
  let score: number | null = null;
  let breakdown: ScoreLine[] | null = null;
  let explanation: string[] | null = null;
  if (game.message_count >= 1 && game.game_mode !== "origin") {
    const { data: guesses } = await client
      .from("guesses")
      .select("model_correct, company_correct, origin_correct")
      .eq("game_id", gameId);
    const scored = await scoreFrom(client, game, guessFlags(guesses ?? []), false);
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
