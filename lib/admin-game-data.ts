import "server-only";

import { requireOwner } from "./admin-access";
import { likePattern, orderTranscript, parseGameSearch, type TranscriptRow } from "./admin-game";
import { serviceOrThrow } from "./rounds";

const listLimit = 50;

export type GameListRow = {
  id: string;
  username: string | null;
  gameMode: string;
  modelName: string;
  status: string;
  messageCount: number;
  score: number | null;
  startedAt: string;
};

export type GameDetail = {
  game: Record<string, unknown>;
  modelName: string;
  transcript: TranscriptRow[];
  guesses: { turn: number; guessedModel: string | null; guessedRegion: string | null; modelCorrect: boolean }[];
  usage: { calls: number; failed: number; inputTokens: number; outputTokens: number; reasoningTokens: number; costUsd: number };
};

async function modelNames(ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await serviceOrThrow().from("models").select("id, name").in("id", [...new Set(ids)]);
  if (error) throw new Error("Could not read games.");
  return new Map((data ?? []).map((row) => [row.id as string, row.name as string]));
}

export async function listGames(raw: string | undefined): Promise<GameListRow[]> {
  await requireOwner();
  const search = parseGameSearch(raw);
  let query = serviceOrThrow()
    .from("games")
    .select("id, username, game_mode, model_id, status, message_count, score, started_at")
    .order("started_at", { ascending: false })
    .limit(listLimit);
  if (search.kind === "id") query = query.eq("id", search.id);
  if (search.kind === "username") query = query.ilike("username", likePattern(search.text));
  const { data, error } = await query;
  if (error) throw new Error("Could not read games.");
  const names = await modelNames((data ?? []).map((row) => row.model_id as string));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    username: (row.username as string | null) ?? null,
    gameMode: row.game_mode as string,
    modelName: names.get(row.model_id as string) ?? (row.model_id as string),
    status: row.status as string,
    messageCount: Number(row.message_count ?? 0),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    startedAt: row.started_at as string,
  }));
}

export async function loadGame(id: string): Promise<GameDetail | null> {
  await requireOwner();
  const client = serviceOrThrow();
  const [game, messages, guesses, usage] = await Promise.all([
    client.from("games").select("*").eq("id", id).maybeSingle(),
    client.from("messages").select("turn, role, content").eq("game_id", id),
    client.from("guesses").select("turn, guessed_model_id, guessed_region, model_correct").eq("game_id", id).order("turn"),
    client.from("usage").select("input_tokens, output_tokens, reasoning_tokens, cost_usd, error_code").eq("game_id", id),
  ]);
  if (game.error || messages.error || guesses.error || usage.error) throw new Error("Could not read games.");
  if (!game.data) return null;
  const guessRows = guesses.data ?? [];
  const names = await modelNames([
    game.data.model_id as string,
    ...guessRows.flatMap((row) => (row.guessed_model_id ? [row.guessed_model_id as string] : [])),
  ]);
  const nameOf = (modelId: string) => names.get(modelId) ?? modelId;
  const usageRows = usage.data ?? [];
  const sum = (key: string) => usageRows.reduce((total, row) => total + Number((row as Record<string, unknown>)[key] ?? 0), 0);
  return {
    game: game.data as Record<string, unknown>,
    modelName: nameOf(game.data.model_id as string),
    transcript: orderTranscript(
      (messages.data ?? []).map((row) => ({ turn: Number(row.turn), role: row.role as string, content: row.content as string })),
    ),
    guesses: guessRows.map((row) => ({
      turn: Number(row.turn),
      guessedModel: row.guessed_model_id ? nameOf(row.guessed_model_id as string) : null,
      guessedRegion: (row.guessed_region as string | null) ?? null,
      modelCorrect: Boolean(row.model_correct),
    })),
    usage: {
      calls: usageRows.length,
      failed: usageRows.filter((row) => row.error_code !== null).length,
      inputTokens: sum("input_tokens"),
      outputTokens: sum("output_tokens"),
      reasoningTokens: sum("reasoning_tokens"),
      costUsd: sum("cost_usd"),
    },
  };
}
