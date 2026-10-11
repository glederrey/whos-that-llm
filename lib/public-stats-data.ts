import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Region, Size } from "./game";
import { computePublicStats, type NamedCategory, type NamedClass, type PublicGameFact, type PublicGuessFact, type PublicUsageFact } from "./public-stats";
import { serviceOrThrow } from "./rounds";

const pageSize = 1000;
const rowCap = 200_000;

export type PublicStatsPayload = {
  stats: ReturnType<typeof computePublicStats>;
  names: Record<string, string>;
};

export async function loadPublicStats(): Promise<PublicStatsPayload> {
  const client = serviceOrThrow();
  const [games, usage, guesses, categories, models, classes, memberships] = await Promise.all([
    readAll(client, "games", "id, model_id, status, message_count, started_at, category, traits"),
    readAll(client, "usage", "id, game_id, model_id, input_tokens, output_tokens"),
    readAll(client, "guesses", "id, game_id, guessed_model_id, model_correct, region_correct"),
    readAll(client, "categories", "id, name, sort_order"),
    readAll(client, "models", "id, name"),
    readAll(client, "classes", "id, name"),
    readAll(client, "model_classes", "model_id, class_id"),
  ]);
  const names: Record<string, string> = {};
  for (const row of models) names[row.id as string] = row.name as string;
  const listed: NamedCategory[] = categories
    .map((row) => ({ id: row.id as string, name: row.name as string, sort: Number(row.sort_order ?? 0) }))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    .map(({ id, name }) => ({ id, name }));
  const classNames: NamedClass[] = classes.map((row) => ({ id: row.id as string, name: row.name as string }));
  const classesByModel = new Map<string, string[]>();
  for (const row of memberships) {
    const modelId = row.model_id as string;
    const classId = row.class_id as string;
    const current = classesByModel.get(modelId) ?? [];
    if (!current.includes(classId)) current.push(classId);
    classesByModel.set(modelId, current);
  }
  return {
    names,
    stats: computePublicStats(
      games.map((row) => gameFact(row, classesByModel.get(row.model_id as string) ?? [])),
      usage.map(usageFact),
      guesses.map(guessFact),
      listed,
      classNames,
    ),
  };
}

function gameFact(row: Record<string, unknown>, classIds: string[]): PublicGameFact {
  const modelId = row.model_id as string;
  const trait = hiddenTrait(row.traits, modelId);
  return {
    id: row.id as string,
    modelId,
    status: row.status as string,
    messageCount: Number(row.message_count ?? 0),
    startedAt: row.started_at as string,
    category: row.category as string,
    size: trait.size,
    region: trait.region,
    classIds,
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
    regionCorrect: Boolean(row.region_correct),
  };
}

function hiddenTrait(traits: unknown, modelId: string): { size: Size | null; region: Region | null } {
  if (!traits || typeof traits !== "object") return { size: null, region: null };
  const models = (traits as { models?: unknown }).models;
  if (!models || typeof models !== "object") return { size: null, region: null };
  const model = (models as Record<string, unknown>)[modelId];
  if (!model || typeof model !== "object") return { size: null, region: null };
  const size = (model as { size?: unknown }).size;
  const region = (model as { region?: unknown }).region;
  return {
    size: size === "small" || size === "medium" || size === "large" ? size : null,
    region: region === "us" || region === "cn" || region === "eu" ? region : null,
  };
}

async function readAll(client: SupabaseClient, table: string, columns: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < rowCap; from += pageSize) {
    const { data, error } = await client.from(table).select(columns).order("id").range(from, from + pageSize - 1);
    if (error) throw new Error("Could not read stats.");
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
