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
import { serviceOrThrow } from "./rounds";

const pageSize = 1000;
const rowCap = 200_000;

export async function loadGameMetrics(): Promise<GameMetrics> {
  await requireOwner();
  const client = serviceOrThrow();
  const [games, usage, guesses] = await Promise.all([
    readAll(client, "games", "id, model_id, status, message_count, started_at"),
    readAll(
      client,
      "usage",
      "id, game_id, model_id, input_tokens, output_tokens, reasoning_tokens, cost_usd, error_code",
    ),
    readAll(client, "guesses", "id, game_id, model_correct"),
  ]);
  const gameFacts: GameFact[] = games.map((row) => ({
    id: row.id as string,
    modelId: row.model_id as string,
    status: row.status as string,
    messageCount: Number(row.message_count ?? 0),
    startedAt: row.started_at as string,
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
  const guessFacts: GuessFact[] = guesses.map((row) => ({
    gameId: row.game_id as string,
    modelCorrect: Boolean(row.model_correct),
  }));
  return computeGameMetrics(gameFacts, usageFacts, guessFacts);
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
