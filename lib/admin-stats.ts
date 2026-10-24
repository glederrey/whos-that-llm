import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "./admin-access";
import {
  computeGameMetrics,
  type GameFact,
  type GameMetrics,
  type GuessFact,
  type UsageFact,
} from "./admin-metrics";
import { computeAdminInsights, type AdminGameFact, type AdminInsights, type AdminUsageFact } from "./admin-insights";
import { modeRows, type ModeRow } from "./mode-rows";
import { serviceOrThrow } from "./rounds";

const pageSize = 1000;
const rowCap = 200_000;

export async function loadGameMetrics(): Promise<GameMetrics> {
  await requireOwner();
  const client = serviceOrThrow();
  const [games, usage, guesses] = await Promise.all([
    readAll(client, "games", "id, model_id, status, game_mode, message_count, started_at, finished_at"),
    readAll(
      client,
      "usage",
      "id, game_id, model_id, input_tokens, output_tokens, reasoning_tokens, cost_usd, error_code",
    ),
    readAll(client, "guesses", "id, game_id, model_correct"),
  ]);
  // Origin rounds stay out of the game figures, like the All modes figures on /statistics.
  // Their usage rows stay in, because the ledger is real spend.
  const originGames = new Set(games.filter((row) => row.game_mode === "origin").map((row) => row.id as string));
  const gameFacts: GameFact[] = games.filter((row) => !originGames.has(row.id as string)).map((row) => ({
    id: row.id as string,
    modelId: row.model_id as string,
    status: row.status as string,
    messageCount: Number(row.message_count ?? 0),
    startedAt: row.started_at as string,
    finishedAt: typeof row.finished_at === "string" && row.finished_at.length > 0 ? row.finished_at : null,
  }));
  const usageFacts: UsageFact[] = usage.map((row) => ({
    gameId: (row.game_id as string | null) ?? null,
    modelId: row.model_id as string,
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    reasoningTokens: Number(row.reasoning_tokens ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
    failed: row.error_code !== null && row.error_code !== undefined,
  }));
  const guessFacts: GuessFact[] = guesses
    .filter((row) => !originGames.has(row.game_id as string))
    .map((row) => ({
      gameId: row.game_id as string,
      modelCorrect: Boolean(row.model_correct),
    }));
  return computeGameMetrics(gameFacts, usageFacts, guessFacts);
}

export async function loadAdminInsights(): Promise<AdminInsights> {
  await requireOwner();
  const client = serviceOrThrow();
  const [games, usage, profiles, models, gameModes] = await Promise.all([
    readAll(
      client,
      "games",
      "id, user_id, model_id, status, game_mode, started_at, finished_at, hints, no_hint",
    ),
    readAll(client, "usage", "id, game_id, model_id, cost_usd, error_code, created_at"),
    readAll(client, "profiles", "id, created_at"),
    readAll(client, "models", "id, name, enabled, available"),
    client.from("game_modes").select("id, name").order("sort_order"),
  ]);
  if (gameModes.error) throw new Error("Could not read stats.");
  const gameFacts: AdminGameFact[] = games.map((row) => ({
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    modelId: row.model_id as string,
    status: row.status as string,
    gameMode: String(row.game_mode ?? ""),
    startedAt: row.started_at as string,
    finishedAt: typeof row.finished_at === "string" && row.finished_at.length > 0 ? row.finished_at : null,
    hints: Array.isArray(row.hints) ? (row.hints as string[]) : [],
    noHint: Boolean(row.no_hint),
  }));
  const usageFacts: AdminUsageFact[] = usage.map((row) => ({
    gameId: (row.game_id as string | null) ?? null,
    modelId: row.model_id as string,
    costUsd: Number(row.cost_usd ?? 0),
    errorCode: (row.error_code as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
  return computeAdminInsights(
    gameFacts,
    usageFacts,
    profiles.map((row) => row.created_at as string),
    models.map((row) => ({ id: row.id as string, name: row.name as string, enabled: Boolean(row.enabled), available: Boolean(row.available) })),
    (gameModes.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
  );
}

export async function loadModeStats(): Promise<ModeRow[]> {
  await requireOwner();
  const client = serviceOrThrow();
  const [games, gameModes] = await Promise.all([
    readAll(client, "games", "id, status, game_mode"),
    client.from("game_modes").select("id, name").order("sort_order"),
  ]);
  if (gameModes.error) throw new Error("Could not read stats.");
  return modeRows(
    games.map((row) => ({ gameMode: String(row.game_mode ?? ""), status: String(row.status ?? "") })),
    (gameModes.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
  );
}

async function readAll(client: SupabaseClient, table: string, columns: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < rowCap; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Could not read stats.");
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
