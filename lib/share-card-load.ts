import "server-only";

import { cache } from "react";
import { isFinishedGame, type ScoreLine, type Traits } from "./game";
import { buildShareCard, isShareGameId, type ShareCard } from "./share-card";
import { serviceOrThrow } from "./rounds";

/** Columns the card needs. Messages, guesses, and usage are not in this list. */
export const shareCardColumns =
  "id, status, game_mode, pool_key, pool_model_ids, difficulty, message_count, score, score_breakdown, model_id, traits, daily_key, username, finished_at";

function asTraits(value: unknown): Traits | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { given?: unknown; models?: unknown };
  if (!Array.isArray(record.given) || !record.models || typeof record.models !== "object") return null;
  return record as Traits;
}

function asBreakdown(value: unknown): ScoreLine[] | null {
  if (!Array.isArray(value)) return null;
  const lines: ScoreLine[] = [];
  for (const line of value) {
    if (!line || typeof line !== "object") continue;
    const label = (line as { label?: unknown }).label;
    if (typeof label !== "string") continue;
    const points = (line as { points?: unknown }).points;
    const multiplier = (line as { multiplier?: unknown }).multiplier;
    lines.push({
      label,
      points: typeof points === "number" ? points : null,
      multiplier: typeof multiplier === "string" ? multiplier : undefined,
    });
  }
  return lines;
}

/** The category name for a category round, deactivated ones included. Null when the category is gone. */
export async function readCategoryName(client: ReturnType<typeof serviceOrThrow>, id: string): Promise<string | null> {
  const category = await client.from("categories").select("name").eq("id", id).maybeSingle();
  if (category.error) throw new Error(category.error.message);
  return typeof category.data?.name === "string" ? category.data.name : null;
}

/**
 * The public card for one finished game.
 * Reads the game row, and the category name when the round is a category.
 * Does not read messages.
 */
export const readShareCard = cache(async (gameId: string): Promise<ShareCard | null> => {
  if (!isShareGameId(gameId)) return null;
  const client = serviceOrThrow();
  const { data, error } = await client.from("games").select(shareCardColumns).eq("id", gameId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !isFinishedGame(data.status)) return null;
  const traits = asTraits(data.traits);
  if (!traits) return null;

  let categoryName: string | null = null;
  if (data.game_mode === "class" && typeof data.pool_key === "string" && data.pool_key.length > 0) {
    categoryName = await readCategoryName(client, data.pool_key);
  }

  return buildShareCard({
    id: data.id,
    gameMode: data.game_mode,
    poolKey: data.pool_key,
    difficulty: data.difficulty,
    poolModelIds: data.pool_model_ids,
    status: data.status,
    messageCount: Number(data.message_count ?? 0),
    score: typeof data.score === "number" ? data.score : null,
    breakdown: asBreakdown(data.score_breakdown),
    modelId: data.model_id,
    traits,
    categoryName,
    dailyKey: typeof data.daily_key === "string" ? data.daily_key : null,
    playerName: typeof data.username === "string" ? data.username : null,
    finishedAt: typeof data.finished_at === "string" ? data.finished_at : null,
  });
});
