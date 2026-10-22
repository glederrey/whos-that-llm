import "server-only";

import { markRosterAvailable, markRosterUnavailable, writeReasoningFlags } from "./admin-roster";
import { runAvailability, type AvailabilityOutcome } from "./availability-run";
import type { CatalogModel, SyncModel } from "./roster-sync";
import { serviceOrThrow } from "./rounds";

/** No owner check: the admin action and the token route each authorize before calling. */
export function checkAvailability(catalog: CatalogModel[], apply: boolean): Promise<AvailabilityOutcome> {
  return runAvailability(catalog, apply, {
    loadRoster,
    markUnavailable: markRosterUnavailable,
    markAvailable: markRosterAvailable,
    writeReasoning: writeReasoningFlags,
  });
}

async function loadRoster(): Promise<SyncModel[] | null> {
  const { data, error } = await serviceOrThrow().from("models").select("id, openrouter_id, name, enabled, available");
  if (error) return null;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    openrouterId: row.openrouter_id as string,
    name: row.name as string,
    enabled: Boolean(row.enabled),
    available: row.available !== false,
  }));
}
