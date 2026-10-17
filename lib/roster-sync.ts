import { modelIdFromOpenRouter, validOpenRouterId } from "./admin-model";
import { dollarsPerMillion } from "./list-price";
import { releasedOnFromCreated } from "./openrouter-draft";
import { lowReasoningSettings, reasoningSettingsNeeded } from "./provider-check";

export type CatalogModel = {
  id: string;
  name: string;
  description: string | null;
  created: number | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  outputModalities: string[];
  modality: string | null;
  reasoning: boolean;
};

export type SyncModel = {
  id: string;
  name: string;
  openrouterId: string;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  enabled: boolean;
  /** False once OpenRouter no longer lists the model. Those rows are not checked again. */
  available: boolean;
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
  markIds: string[];
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
    const details = catalogDetails(row);
    models.push({
      id: trimmed,
      name: details.name,
      description: details.description,
      created: details.created,
      inputUsdPerMtok: catalogPrice(prices.prompt),
      outputUsdPerMtok: catalogPrice(prices.completion),
      outputModalities: details.outputModalities,
      modality: details.modality,
      reasoning: details.reasoning,
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

/** Models still listed on OpenRouter stay as they are, including ones that are already off. Models already marked unavailable are left alone. An empty catalog is refused. */
export function planUnavailable(roster: SyncModel[], catalog: CatalogModel[]): AvailabilityPlan | null {
  if (catalog.length === 0) return null;
  const ids = new Set(catalogById(catalog).keys());
  const unavailable = roster.filter((model) => model.available && !ids.has(model.openrouterId.trim()));
  return {
    unavailable: unavailable.map((model) => ({ id: model.id, name: model.name })),
    markIds: unavailable.map((model) => model.id),
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

const newModelWindowSeconds = 30 * 24 * 60 * 60;

export type NewModelCard = {
  id: string;
  name: string;
  description: string | null;
  releasedOn: string | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  reasoning: boolean;
};

export type NewModelsResult =
  | { ok: true; models: NewModelCard[] }
  | { ok: false; error: string };

export type AddModelsResult = { ok: true; added: number } | { ok: false; error: string };

/** Text output, and not an embedding or moderation model. Image-only and audio-only stay out. */
export function isTextGenerationModel(model: CatalogModel): boolean {
  const outputs = model.outputModalities.map((item) => item.toLowerCase());
  const blob = [model.id, model.name, model.modality ?? "", ...outputs].join("\n").toLowerCase();
  if (blob.includes("embedding") || blob.includes("moderation")) return false;
  return outputs.includes("text");
}

/**
 * The same model when the OpenRouter id, the roster id, or the roster OpenRouter slug match,
 * including one trailing snapshot date (0813, 20260420, 02-23, 2603).
 */
export function sameRosterModel(openrouterId: string, roster: { id: string; openrouterId: string }): boolean {
  const known = identityKeys(roster.openrouterId, roster.id);
  for (const key of identityKeys(openrouterId)) {
    if (known.has(key)) return true;
  }
  return false;
}

/** Newest text models from the last 30 days that are not already on the roster. Company is ignored. */
export function planNewModels(roster: SyncModel[], catalog: CatalogModel[], nowSeconds: number): NewModelCard[] {
  if (!Number.isFinite(nowSeconds)) return [];
  const known = new Set(roster.flatMap((model) => [...identityKeys(model.openrouterId, model.id)]));
  const cutoff = nowSeconds - newModelWindowSeconds;
  const byId = new Map<string, CatalogModel>();
  for (const model of catalog) byId.set(model.id, model);
  const matches = [...byId.values()].filter((model) => {
    if (!isTextGenerationModel(model) || openRouterModelHref(model.id) === null) return false;
    if (model.created === null || model.created < cutoff) return false;
    return ![...identityKeys(model.id)].some((key) => known.has(key));
  });
  matches.sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id));
  return matches.map((model) => ({
    id: model.id,
    name: model.name.trim() || model.id,
    description: model.description,
    releasedOn: releasedOnFromCreated(model.created) || null,
    inputUsdPerMtok: model.inputUsdPerMtok,
    outputUsdPerMtok: model.outputUsdPerMtok,
    reasoning: model.reasoning,
  }));
}

/** A single OpenRouter handle, with the slash left intact. */
export function openRouterModelHref(id: string): string | null {
  const trimmed = id.trim();
  if (!validOpenRouterId(trimmed) || /[?#\\]|\.\./.test(trimmed)) return null;
  return `https://openrouter.ai/${trimmed}`;
}

function catalogDetails(row: object): Pick<CatalogModel, "name" | "description" | "created" | "outputModalities" | "modality" | "reasoning"> {
  const record = row as { name?: unknown; description?: unknown; created?: unknown; architecture?: unknown; reasoning?: unknown };
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const description = typeof record.description === "string" && record.description.trim() ? record.description.trim() : null;
  const architecture = record.architecture;
  const arch =
    architecture && typeof architecture === "object" && !Array.isArray(architecture)
      ? (architecture as { modality?: unknown; output_modalities?: unknown })
      : {};
  const modality = typeof arch.modality === "string" && arch.modality.trim() ? arch.modality.trim().toLowerCase() : null;
  const listed = Array.isArray(arch.output_modalities)
    ? arch.output_modalities.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim().toLowerCase()] : []))
    : [];
  return {
    name,
    description,
    created: catalogCreated(record.created),
    outputModalities: listed.length > 0 ? listed : outputsFromModality(modality),
    modality,
    reasoning: catalogReasoning(record.reasoning),
  };
}

function catalogReasoning(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function outputsFromModality(modality: string | null): string[] {
  if (!modality) return [];
  const side = modality.split("->")[1] ?? "";
  return side.split("+").map((part) => part.trim()).filter(Boolean);
}

function catalogCreated(value: unknown): number | null {
  const seconds = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

function identityKeys(openrouterId: string, rosterId = ""): Set<string> {
  const keys = new Set<string>();
  const handle = openrouterId.trim().toLowerCase();
  if (handle) keys.add(`handle:${handle}`);
  for (const value of [openrouterId, rosterId]) {
    const slug = slugOf(value);
    if (!slug) continue;
    keys.add(`slug:${slug}`);
    keys.add(`slug:${stripSnapshotDate(slug)}`);
  }
  return keys;
}

function slugOf(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) return modelIdFromOpenRouter(trimmed);
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z0-9-]{2,64}$/.test(slug) ? slug : null;
}

/** One trailing snapshot date. Version tails such as 4-1 stay on the slug. */
function stripSnapshotDate(slug: string): string {
  const eight = slug.match(/^(.*)-(\d{8})$/);
  if (eight) {
    if (eight[1].length >= 2 && isSnapshotDay(eight[2])) return eight[1];
    return slug;
  }
  const monthDay = slug.match(/^(.*)-(\d{2})-(\d{2})$/);
  if (monthDay) {
    const month = Number(monthDay[2]);
    const day = Number(monthDay[3]);
    if (monthDay[1].length >= 2 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return monthDay[1];
    return slug;
  }
  const four = slug.match(/^(.*)-(\d{4})$/);
  if (!four || four[1].length < 2) return slug;
  const head = Number(four[2].slice(0, 2));
  const tail = Number(four[2].slice(2));
  if (head >= 1 && head <= 12 && tail >= 1 && tail <= 31) return four[1];
  if (head >= 20 && head <= 39 && tail >= 1 && tail <= 12) return four[1];
  return slug;
}

function isSnapshotDay(digits: string): boolean {
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (year < 2000 || year > 2099) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
