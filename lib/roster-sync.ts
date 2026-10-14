import { dollarsPerMillion } from "./list-price";
import { catalogSupportsReasoning, lowReasoningSettings, reasoningSettingsNeeded } from "./provider-check";

export type CatalogModel = {
  id: string;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  reasoning: boolean;
};

export type SyncModel = {
  id: string;
  name: string;
  openrouterId: string;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  enabled: boolean;
};

export type PriceSide = {
  oldPrice: number | null;
  newPrice: number;
};

export type PriceChange = {
  id: string;
  name: string;
  input: PriceSide | null;
  output: PriceSide | null;
};

export type NotUpdatedModel = {
  id: string;
  name: string;
};

export type PriceUpdate = {
  id: string;
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
};

export type PricePlan = {
  changes: PriceChange[];
  notUpdated: NotUpdatedModel[];
  updates: PriceUpdate[];
};

export type UnavailableModel = {
  id: string;
  name: string;
};

export type AvailabilityPlan = {
  unavailable: UnavailableModel[];
  disableIds: string[];
};

export type PriceSyncResult =
  | { ok: true; changes: PriceChange[]; notUpdated: NotUpdatedModel[] }
  | { ok: false; error: string };

export type AvailabilityResult =
  | { ok: true; unavailable: UnavailableModel[] }
  | { ok: false; error: string };

export function formatSyncPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  return `$${value}`;
}

export type CatalogPage = {
  models: CatalogModel[];
  total: number | null;
  next: string | null;
};

export function parseOpenRouterCatalog(body: unknown): CatalogModel[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const models: CatalogModel[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed) continue;
    const pricing = (row as { pricing?: unknown }).pricing;
    const prices =
      pricing && typeof pricing === "object" && !Array.isArray(pricing)
        ? (pricing as { prompt?: unknown; completion?: unknown })
        : {};
    models.push({
      id: trimmed,
      inputUsdPerMtok: catalogPrice(prices.prompt),
      outputUsdPerMtok: catalogPrice(prices.completion),
      reasoning: catalogSupportsReasoning(row),
    });
  }
  return models;
}

export function parseCatalogPage(body: unknown): CatalogPage | null {
  const models = parseOpenRouterCatalog(body);
  if (!models || !body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as { total_count?: unknown; links?: unknown };
  let total: number | null = null;
  if (record.total_count !== undefined) {
    if (typeof record.total_count !== "number" || !Number.isInteger(record.total_count) || record.total_count < 0) return null;
    total = record.total_count;
  }
  if (record.links === undefined || record.links === null) return { models, total, next: null };
  if (typeof record.links !== "object" || Array.isArray(record.links)) return null;
  const raw = (record.links as { next?: unknown }).next;
  if (raw === undefined || raw === null) return { models, total, next: null };
  if (typeof raw !== "string" || !raw.trim()) return null;
  return { models, total, next: raw.trim() };
}

/** Follow only another page of the OpenRouter models list. */
export function nextModelsUrl(next: string): string | null {
  const candidate = next.startsWith("/") ? `https://openrouter.ai${next}` : next;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== "openrouter.ai" || url.pathname !== "/api/v1/models") return null;
  return url.toString();
}

/** A short page is not a catalog. Comparing the roster to it would turn live models off. */
export function mergeCatalogPages(pages: CatalogPage[]): CatalogModel[] | null {
  if (pages.length === 0) return null;
  const models: CatalogModel[] = [];
  let total: number | null = null;
  for (const [index, page] of pages.entries()) {
    models.push(...page.models);
    if (page.total !== null) {
      if (total === null) total = page.total;
      else if (total !== page.total) return null;
    }
    const last = index === pages.length - 1;
    if (last ? page.next !== null : page.next === null) return null;
  }
  const ids = new Set(models.map((model) => model.id));
  if (ids.size === 0 || (total !== null && ids.size !== total)) return null;
  return models;
}

/** A roster model with the same list price is left out. A model with no OpenRouter price is not updated. */
export function planPriceUpdates(roster: SyncModel[], catalog: CatalogModel[]): PricePlan {
  const byId = catalogById(catalog);
  const changes: PriceChange[] = [];
  const notUpdated: NotUpdatedModel[] = [];
  const updates: PriceUpdate[] = [];
  for (const model of roster) {
    const remote = byId.get(model.openrouterId.trim());
    const input = remote?.inputUsdPerMtok ?? null;
    const output = remote?.outputUsdPerMtok ?? null;
    if (input === null || output === null) {
      notUpdated.push({ id: model.id, name: model.name });
      continue;
    }
    const inputChanged = input !== model.inputUsdPerMtok;
    const outputChanged = output !== model.outputUsdPerMtok;
    if (!inputChanged && !outputChanged) continue;
    changes.push({
      id: model.id,
      name: model.name,
      input: inputChanged ? { oldPrice: model.inputUsdPerMtok, newPrice: input } : null,
      output: outputChanged ? { oldPrice: model.outputUsdPerMtok, newPrice: output } : null,
    });
    updates.push({ id: model.id, inputUsdPerMtok: input, outputUsdPerMtok: output });
  }
  return { changes, notUpdated, updates };
}

/** Models still listed on OpenRouter stay as they are, including ones that are already off. An empty catalog is refused. */
export function planUnavailable(roster: SyncModel[], catalog: CatalogModel[]): AvailabilityPlan | null {
  if (catalog.length === 0) return null;
  const ids = new Set(catalogById(catalog).keys());
  const unavailable = roster.filter((model) => !ids.has(model.openrouterId.trim()));
  return {
    unavailable: unavailable.map((model) => ({ id: model.id, name: model.name })),
    disableIds: unavailable.filter((model) => model.enabled).map((model) => model.id),
  };
}

export type ReasoningRow = {
  id: string;
  openrouterId: string;
  reasoning: boolean;
  providerSettings: unknown;
};

export type ReasoningUpdate = {
  id: string;
  reasoning: boolean;
  /** Set when a reasoning model still has empty provider settings. Null leaves the stored object alone. */
  providerSettings: { reasoning: { effort: "low" } } | null;
};

/** Keep models.reasoning aligned with the catalog. An empty settings object on a reasoning model is filled with effort low. */
export function planReasoningUpdates(roster: ReasoningRow[], catalog: CatalogModel[]): ReasoningUpdate[] {
  const byId = catalogById(catalog);
  const updates: ReasoningUpdate[] = [];
  for (const row of roster) {
    const remote = byId.get(row.openrouterId.trim());
    if (!remote) continue;
    const fill = reasoningSettingsNeeded(remote.reasoning, row.providerSettings);
    if (remote.reasoning === row.reasoning && !fill) continue;
    updates.push({
      id: row.id,
      reasoning: remote.reasoning,
      providerSettings: fill ? lowReasoningSettings() : null,
    });
  }
  return updates;
}

function catalogById(models: CatalogModel[]): Map<string, CatalogModel> {
  const map = new Map<string, CatalogModel>();
  for (const model of models) map.set(model.id, model);
  return map;
}

function catalogPrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return dollarsPerMillion(String(value));
}
