import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computePublicStats, type NamedCategory, type NamedGameMode } from "./public-stats";
import { factsFromRows, type StatisticsFacts } from "./public-stats-facts";
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
  const [facts, gameModes, models, categories, companies, originRows] = await Promise.all([
    client.rpc("statistics_facts"),
    readAll(client, "game_modes", "id, name, sort_order"),
    readAll(client, "models", "id, name"),
    readAll(client, "categories", "id, name, enabled"),
    readAll(client, "companies", "id, name"),
    readAll(client, "origins", "id, name, flag"),
  ]);
  if (facts.error || !facts.data) throw new Error("Could not read stats.");
  const { games, usage, guesses } = factsFromRows(facts.data as StatisticsFacts);
  const names: Record<string, string> = {};
  for (const row of models) names[row.id as string] = row.name as string;
  const listed: NamedGameMode[] = gameModes
    .map((row) => ({ id: row.id as string, name: row.name as string, sort: Number(row.sort_order ?? 0) }))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    .map(({ id, name }) => ({ id, name }));
  // A category that is turned off is left out; its games stay in the other tables.
  const categoryNames: NamedCategory[] = categories.flatMap((row) => (row.enabled ? [{ id: row.id as string, name: row.name as string }] : []));
  const origins: PublicStatsPayload["origins"] = {};
  for (const row of originRows) origins[row.id as string] = { name: row.name as string, flag: row.flag as string };
  return {
    names,
    origins,
    stats: computePublicStats(
      games,
      usage,
      guesses,
      listed,
      { categories: categoryNames, companies: companies.map((row) => ({ id: row.id as string, name: row.name as string })) },
    ),
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
