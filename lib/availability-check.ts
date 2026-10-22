import "server-only";

import {
  markRosterAvailable,
  markRosterAvailableUnchecked,
  markRosterUnavailable,
  markRosterUnavailableUnchecked,
  writeReasoningFlags,
  writeReasoningFlagsUnchecked,
} from "./admin-roster";
import { runAvailability, type AvailabilityOutcome } from "./availability-run";
import type { CatalogModel, SyncModel } from "./roster-sync";
import { serviceOrThrow } from "./rounds";

/**
 * "owner": the admin action, which has a session, so the checked helpers run. "token": the bot route,
 * which authorized by token and has no session, so the unchecked helpers run.
 */
export function checkAvailability(catalog: CatalogModel[], apply: boolean, caller: "owner" | "token"): Promise<AvailabilityOutcome> {
  const token = caller === "token";
  return runAvailability(catalog, apply, {
    loadRoster,
    markUnavailable: token ? markRosterUnavailableUnchecked : markRosterUnavailable,
    markAvailable: token ? markRosterAvailableUnchecked : markRosterAvailable,
    writeReasoning: token ? writeReasoningFlagsUnchecked : writeReasoningFlags,
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
