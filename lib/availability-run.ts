import { planAvailability, type AvailabilityChange, type CatalogModel, type SyncModel } from "./roster-sync";

export type AvailabilityStore = {
  loadRoster(): Promise<SyncModel[] | null>;
  markUnavailable(ids: string[]): Promise<boolean>;
  markAvailable(ids: string[]): Promise<boolean>;
  writeReasoning(catalog: CatalogModel[]): Promise<boolean>;
};

export type AvailabilityOutcome =
  | { ok: true; applied: boolean; checked: number; newlyUnavailable: AvailabilityChange[]; backAvailable: AvailabilityChange[] }
  | { ok: false; error: string; status: 500 | 502 };

/**
 * Plan against the roster, and write only when `apply` is true. The caller passes a catalog it just fetched,
 * so an apply never reuses an earlier dry run. The guard in planAvailability runs on every call.
 */
export async function runAvailability(catalog: CatalogModel[], apply: boolean, store: AvailabilityStore): Promise<AvailabilityOutcome> {
  const roster = await store.loadRoster();
  if (!roster) return { ok: false, error: "Could not read the roster.", status: 500 };
  const plan = planAvailability(roster, catalog);
  if (!plan) return { ok: false, error: "OpenRouter returned too few models to trust. Nothing was changed.", status: 502 };
  if (apply) {
    if (!(await store.markUnavailable(plan.newlyUnavailable.map((model) => model.id)))) {
      return { ok: false, error: "Could not mark those models unavailable.", status: 500 };
    }
    if (!(await store.markAvailable(plan.backAvailable.map((model) => model.id)))) {
      return { ok: false, error: "Could not bring those models back.", status: 500 };
    }
    if (!(await store.writeReasoning(catalog))) {
      return { ok: false, error: "Could not save which models can reason.", status: 500 };
    }
  }
  return { ok: true, applied: apply, checked: roster.length, ...plan };
}
