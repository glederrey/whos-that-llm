import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Origin, Size } from "./game";
import { computePublicStats, type NamedCategory, type NamedGameMode, type PublicGameFact, type PublicGuessFact, type PublicUsageFact } from "./public-stats";
import { serviceOrThrow } from "./rounds";

const pageSize = 1000;
const rowCap = 200_000;

export type PublicStatsPayload = {
  stats: ReturnType<typeof computePublicStats>;
  names: Record<string, string>;
  /** Name and flag of every origin, by id. */
  origins: Record<string, { name: string; flag: string }>;
};

export async function loadPublicStats(): Promise<PublicStatsPayload> {
  const client = serviceOrThrow();
  const [games, usage, guesses, gameModes, models, categories, memberships, originRows] = await Promise.all([
    readAll(client, "games", "id, model_id, status, message_count, started_at, finished_at, game_mode, traits, pool_model_ids"),
    readAll(client, "usage", "id, game_id, model_id, input_tokens, output_tokens"),
    readAll(client, "guesses", "id, game_id, guessed_model_id, guessed_origin, model_correct, origin_correct"),
    readAll(client, "game_modes", "id, name, sort_order"),
    readAll(client, "models", "id, name"),
    readAll(client, "categories", "id, name, enabled"),
    readAll(client, "model_categories", "model_id, category_id", ["model_id", "category_id"]),
    readAll(client, "origins", "id, name, flag"),
  ]);
  const names: Record<string, string> = {};
  for (const row of models) names[row.id as string] = row.name as string;
  const listed: NamedGameMode[] = gameModes
    .map((row) => ({ id: row.id as string, name: row.name as string, sort: Number(row.sort_order ?? 0) }))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    .map(({ id, name }) => ({ id, name }));
  // A category that is turned off is left out; its games stay in the other tables.
  const categoryNames: NamedCategory[] = categories.flatMap((row) => (row.enabled ? [{ id: row.id as string, name: row.name as string }] : []));
  const categoriesByModel = new Map<string, string[]>();
  for (const row of memberships) {
    const modelId = row.model_id as string;
    const categoryId = row.category_id as string;
    const current = categoriesByModel.get(modelId) ?? [];
    if (!current.includes(categoryId)) current.push(categoryId);
    categoriesByModel.set(modelId, current);
  }
  const origins: PublicStatsPayload["origins"] = {};
  for (const row of originRows) origins[row.id as string] = { name: row.name as string, flag: row.flag as string };
  return {
    names,
    origins,
    stats: computePublicStats(
      games.map((row) => gameFact(row, categoriesByModel.get(row.model_id as string) ?? [])),
      usage.map(usageFact),
      guesses.map(guessFact),
      listed,
      categoryNames,
    ),
  };
}

function gameFact(row: Record<string, unknown>, categoryIds: string[]): PublicGameFact {
  const modelId = row.model_id as string;
  const trait = hiddenTrait(row.traits, modelId);
  return {
    id: row.id as string,
    modelId,
    status: row.status as string,
    messageCount: Number(row.message_count ?? 0),
    startedAt: row.started_at as string,
    finishedAt: typeof row.finished_at === "string" && row.finished_at.length > 0 ? row.finished_at : null,
    gameMode: row.game_mode as string,
    size: trait.size,
    origin: trait.origin,
    categoryIds,
    poolModelIds: Array.isArray(row.pool_model_ids) ? row.pool_model_ids.flatMap((id) => (typeof id === "string" ? [id] : [])) : [],
  };
}

function usageFact(row: Record<string, unknown>): PublicUsageFact {
  return {
    gameId: (row.game_id as string | null) ?? null,
    modelId: row.model_id as string,
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
  };
}

function guessFact(row: Record<string, unknown>): PublicGuessFact {
  return {
    gameId: row.game_id as string,
    modelCorrect: Boolean(row.model_correct),
    guessedModelId: (row.guessed_model_id as string | null) ?? null,
    guessedOrigin: (row.guessed_origin as string | null) ?? null,
    originCorrect: Boolean(row.origin_correct),
  };
}

function hiddenTrait(traits: unknown, modelId: string): { size: Size | null; origin: Origin | null } {
  if (!traits || typeof traits !== "object") return { size: null, origin: null };
  const models = (traits as { models?: unknown }).models;
  if (!models || typeof models !== "object") return { size: null, origin: null };
  const model = (models as Record<string, unknown>)[modelId];
  if (!model || typeof model !== "object") return { size: null, origin: null };
  const size = (model as { size?: unknown }).size;
  const origin = (model as { origin?: unknown }).origin;
  return {
    size: size === "nano" || size === "small" || size === "medium" || size === "large" || size === "xxl" ? size : null,
    origin: typeof origin === "string" && origin.length > 0 ? origin : null,
  };
}

async function readAll(
  client: SupabaseClient,
  table: string,
  columns: string,
  orderBy: readonly string[] = ["id"],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < rowCap; from += pageSize) {
    let query = client.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error("Could not read stats.");
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
