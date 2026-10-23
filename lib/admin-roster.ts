import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "./admin-access";
import {
  categoryIdFromName,
  chooseCategoryIcon,
  parseCategoryFields,
  parseCategoryId,
  parseCategoryIds,
  diffModelIds,
  parseModelIds,
  type CategoryNotice,
} from "./admin-category";
import type { CustomModel } from "./custom-mode";
import { originFlag, originLabel, sizeLabel } from "./game-labels";
import {
  canTurnOn,
  companyIdFromName,
  modelIdFromOpenRouter,
  parseModelFields,
  parseModelId,
  parseReleasedOn,
  parseSize,
  releasedOnForYear,
  type RosterNotice,
} from "./admin-model";
import { difficultyFromStored, difficultyNumber, parseDifficulty } from "./difficulty";
import type { Origin, Size } from "./game";
import type { CategoryRow, RosterRow } from "./roster-row";

export type { CategoryRow, RosterRow } from "./roster-row";
import { planReasoningUpdates, type CatalogModel } from "./roster-sync";
import { randomBytes } from "node:crypto";
import { categoryImagePath, companyLogoPath, logoBucketPath, readLogo } from "./logos";
import { loadCategoryEntries } from "./category-data";
import { publicImageCacheControl } from "./profile";
import { enabledModelCounts } from "./model-counts";
import { companyForOrg, type CompanyChoice } from "./openrouter-draft";
import { countedPlayerId } from "./anonymize-account";
import { first, presentLogo, serviceOrThrow } from "./rounds";

export type AdminStats = {
  roster: number;
  active: number;
  players: number;
  gamesToday: number;
  games: number;
};

type CompanyRow = { id: string; name: string; origin: Origin };

export type CategoryListRow = CategoryRow & { modelCount: number; modelIds: string[] };
export type CompanyListRow = CompanyRow & { modelCount: number };

export async function loadAdminStats(): Promise<AdminStats> {
  await requireOwner();
  const client = serviceOrThrow();
  const start = utcDayStart();
  const [roster, active, games, gamesToday, players] = await Promise.all([
    headCount(client.from("models").select("id", { count: "exact", head: true })),
    headCount(client.from("models").select("id", { count: "exact", head: true }).eq("enabled", true)),
    headCount(client.from("games").select("id", { count: "exact", head: true })),
    headCount(client.from("games").select("id", { count: "exact", head: true }).gte("started_at", start)),
    countPlayers(client),
  ]);
  return { roster, active, players, gamesToday, games };
}

export async function loadRoster(): Promise<{ rows: RosterRow[]; companies: CompanyRow[]; categories: CategoryRow[] }> {
  await requireOwner();
  const client = serviceOrThrow();
  const [{ data, error }, companies, categories] = await Promise.all([
    client
      .from("models")
      .select("id, openrouter_id, name, size, difficulty, released_on, enabled, available, logo_path, company_id, companies(name, origin, logo_path), model_categories(category_id)")
      .order("enabled", { ascending: false })
      .order("name"),
    loadCompanies(client),
    loadCategories(client),
  ]);
  if (error || !companies || !categories) throw new Error("Could not read the roster.");
  const categoryName = new Map(categories.map((item) => [item.id, item.name]));
  const rows: RosterRow[] = (data ?? []).map((row) => {
    const company = first(row.companies as { name: string; origin: Origin; logo_path: string } | { name: string; origin: Origin; logo_path: string }[] | null);
    const companyId = row.company_id as string;
    const categoryIds = membershipIds(row.model_categories);
    return {
      id: row.id as string,
      openrouterId: row.openrouter_id as string,
      name: row.name as string,
      companyName: company?.name ?? companyId,
      origin: company?.origin ?? "us",
      year: String(row.released_on ?? "").slice(0, 4),
      size: row.size as Size,
      difficulty: difficultyFromStored(row.difficulty),
      inputUsdPerMtok: null,
      outputUsdPerMtok: null,
      enabled: Boolean(row.enabled),
      available: row.available !== false,
      logoUrl: presentLogo((row.logo_path as string | null) || company?.logo_path || "", companyId),
      categoryIds,
      categoryNames: categoryIds.map((id) => categoryName.get(id) ?? id).join(", "),
    };
  });
  return { rows, companies, categories };
}

export async function createRosterModel(raw: {
  openrouterId?: string;
  name?: string;
  company?: string;
  origin?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: string;
  categoryIds?: string[];
}): Promise<RosterNotice | null> {
  await requireOwner();
  const fields = parseModelFields(raw);
  const categoryIds = parseCategoryIds(raw.categoryIds ?? []);
  if (!fields || !categoryIds) return "invalid";
  const id = modelIdFromOpenRouter(fields.openrouterId);
  if (!id) return "invalid";
  const client = serviceOrThrow();
  const taken = await client.from("models").select("id").eq("id", id).maybeSingle();
  if (taken.error) return "save";
  if (taken.data) return "taken";
  const duplicate = await client.from("models").select("id").eq("openrouter_id", fields.openrouterId).maybeSingle();
  if (duplicate.error) return "save";
  if (duplicate.data) return "duplicate";
  const company = await resolveCompany(client, fields.company, fields.origin);
  if (typeof company === "string") return company;
  const { error } = await client.from("models").insert({
    id,
    openrouter_id: fields.openrouterId,
    name: fields.name,
    company_id: company.id,
    size: fields.size,
    difficulty: difficultyNumber[fields.difficulty],
    open_weights: false,
    reasoning: false,
    provider_settings: {},
    released_on: fields.releasedOn ?? releasedOnForYear(null, fields.year),
    enabled: false,
    logo_path: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return error.code === "23505" ? "duplicate" : "save";
  return replaceModelCategories(client, id, categoryIds);
}

export async function updateRosterModel(raw: {
  id?: string;
  openrouterId?: string;
  name?: string;
  company?: string;
  origin?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: string;
  categoryIds?: string[];
}): Promise<RosterNotice | null> {
  await requireOwner();
  const id = parseModelId(raw.id ?? "");
  const fields = parseModelFields(raw);
  const categoryIds = parseCategoryIds(raw.categoryIds ?? []);
  if (!id || !fields || !categoryIds) return "invalid";
  const client = serviceOrThrow();
  const current = await client.from("models").select("id, released_on").eq("id", id).maybeSingle();
  if (current.error || !current.data) return "save";
  const duplicate = await client.from("models").select("id").eq("openrouter_id", fields.openrouterId).maybeSingle();
  if (duplicate.error) return "save";
  if (duplicate.data && duplicate.data.id !== id) return "duplicate";
  const company = await resolveCompany(client, fields.company, fields.origin);
  if (typeof company === "string") return company;
  const patch: Record<string, unknown> = {
    openrouter_id: fields.openrouterId,
    name: fields.name,
    company_id: company.id,
    size: fields.size,
    difficulty: difficultyNumber[fields.difficulty],
    released_on: fields.releasedOn ?? releasedOnForYear(current.data.released_on as string | null, fields.year),
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("models").update(patch).eq("id", id);
  if (error) return error.code === "23505" ? "duplicate" : "save";
  return replaceModelCategories(client, id, categoryIds);
}

export async function setRosterEnabled(idRaw: string, enabled: boolean): Promise<RosterNotice | null> {
  await requireOwner();
  const id = parseModelId(idRaw);
  if (!id) return "save";
  const client = serviceOrThrow();
  const current = await client
    .from("models")
    .select("id, released_on, reasoning, provider_settings, available")
    .eq("id", id)
    .maybeSingle();
  if (current.error || !current.data) return "save";
  if (enabled && current.data.available === false) return "unavailable";
  if (enabled && !canTurnOn({
    releasedOn: current.data.released_on as string | null,
    reasoning: Boolean(current.data.reasoning),
    providerSettings: current.data.provider_settings,
  })) {
    return current.data.released_on ? "reasoning" : "year";
  }
  const { error } = await client
    .from("models")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return "save";
  return null;
}

export async function writeReasoningFlags(catalog: CatalogModel[]): Promise<boolean> {
  await requireOwner();
  return writeReasoningFlagsUnchecked(catalog);
}

/** No owner check. Only lib/availability-check.ts imports this, after its own authorization. */
export async function writeReasoningFlagsUnchecked(catalog: CatalogModel[]): Promise<boolean> {
  const client = serviceOrThrow();
  const { data, error } = await client.from("models").select("id, openrouter_id, reasoning, provider_settings");
  if (error) return false;
  const updates = planReasoningUpdates(
    (data ?? []).map((row) => ({
      id: row.id as string,
      openrouterId: row.openrouter_id as string,
      reasoning: Boolean(row.reasoning),
      providerSettings: row.provider_settings,
    })),
    catalog,
  );
  for (const update of updates) {
    const id = parseModelId(update.id);
    if (!id) return false;
    const patch: Record<string, unknown> = {
      reasoning: update.reasoning,
      updated_at: new Date().toISOString(),
    };
    if (update.providerSettings) patch.provider_settings = update.providerSettings;
    const { error: writeError } = await client.from("models").update(patch).eq("id", id);
    if (writeError) return false;
  }
  return true;
}

export async function markRosterUnavailable(ids: string[]): Promise<boolean> {
  await requireOwner();
  return markRosterUnavailableUnchecked(ids);
}

/** No owner check. Only lib/availability-check.ts imports this, after its own authorization. */
export async function markRosterUnavailableUnchecked(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const clean: string[] = [];
  for (const raw of ids) {
    const id = parseModelId(raw);
    if (!id) return false;
    clean.push(id);
  }
  const client = serviceOrThrow();
  // Off and unavailable, not deleted, so a game that already drew the model still resolves.
  const { error } = await client
    .from("models")
    .update({ available: false, enabled: false, updated_at: new Date().toISOString() })
    .in("id", clean);
  return !error;
}

export async function markRosterAvailable(ids: string[]): Promise<boolean> {
  await requireOwner();
  return markRosterAvailableUnchecked(ids);
}

/** Only `available`. `enabled` stays false: the constraint keeps it off and the admin turns it on by hand. No owner check. Only lib/availability-check.ts imports this. */
export async function markRosterAvailableUnchecked(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const clean: string[] = [];
  for (const raw of ids) {
    const id = parseModelId(raw);
    if (!id) return false;
    clean.push(id);
  }
  const { error } = await serviceOrThrow().from("models").update({ available: true }).in("id", clean).eq("available", false);
  return !error;
}

export async function insertDiscoveredModels(
  models: {
    id: string;
    name: string;
    releasedOn: string | null;
    size: string;
    difficulty: string;
    reasoning: boolean;
  }[],
  companies: CompanyChoice[],
): Promise<number | null> {
  await requireOwner();
  if (models.length === 0) return 0;
  const client = serviceOrThrow();
  let added = 0;
  let failed = 0;
  for (const model of models) {
    const openrouterId = model.id.trim();
    const id = modelIdFromOpenRouter(openrouterId);
    const company = companyForOrg(openrouterId.slice(0, openrouterId.indexOf("/")), companies);
    const name = model.name.trim().slice(0, 80);
    const size = parseSize(model.size);
    const difficulty = parseDifficulty(model.difficulty);
    if (!id || !company || !name || !size || !difficulty) {
      failed += 1;
      continue;
    }
    const released = model.releasedOn ? parseReleasedOn(model.releasedOn) : null;
    const { error } = await client.from("models").insert({
      id,
      openrouter_id: openrouterId,
      name,
      company_id: company.id,
      size,
      difficulty: difficultyNumber[difficulty],
      open_weights: false,
      reasoning: model.reasoning,
      provider_settings: model.reasoning ? { reasoning: { effort: "low" } } : {},
      released_on: released,
      enabled: false,
      logo_path: null,
      updated_at: new Date().toISOString(),
    });
    if (!error) added += 1;
    else if (error.code === "23505") continue;
    else failed += 1;
  }
  if (added === 0 && failed > 0) return null;
  return added;
}

async function resolveCompany(client: SupabaseClient, name: string, origin: Origin): Promise<CompanyRow | RosterNotice> {
  const id = companyIdFromName(name);
  if (!id) return "invalid";
  const companies = await loadCompanies(client);
  if (!companies) return "save";
  const trimmed = name.trim();
  const existing = companies.find((company) => company.id === id || company.name.toLowerCase() === trimmed.toLowerCase());
  if (!existing) {
    const { error } = await client.from("companies").insert({
      id,
      name: trimmed,
      origin,
      logo_path: companyLogoPath(id),
    });
    if (error) return "save";
    return { id, name: trimmed, origin };
  }
  if (existing.origin !== origin) {
    const { error } = await client.from("companies").update({ origin }).eq("id", existing.id);
    if (error) return "save";
    existing.origin = origin;
  }
  return existing;
}

async function loadCompanies(client: SupabaseClient): Promise<CompanyRow[] | null> {
  const { data, error } = await client.from("companies").select("id, name, origin").order("name");
  if (error) return null;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    origin: row.origin as Origin,
  }));
}

async function loadEnabledCounts(client: SupabaseClient) {
  const { data, error } = await client.from("models").select("enabled, company_id, model_categories(category_id)");
  if (error) return null;
  const memberships = (data ?? []).map((row) => ({
    enabled: Boolean(row.enabled),
    companyId: typeof row.company_id === "string" ? row.company_id : "",
    categoryIds: membershipIds(row.model_categories),
  }));
  return enabledModelCounts(memberships);
}

export async function loadCategoryList(): Promise<{
  categories: CategoryListRow[];
  companies: CompanyRow[];
  models: CustomModel[];
}> {
  await requireOwner();
  const client = serviceOrThrow();
  const [categories, companies, { data, error }] = await Promise.all([
    loadCategories(client),
    loadCompanies(client),
    client
      .from("models")
      .select(
        "id, name, enabled, logo_path, company_id, size, released_on, companies(name, origin, logo_path, origins(name, flag)), model_categories(category_id)",
      )
      .order("name"),
  ]);
  if (!categories || !companies || error) throw new Error("Could not read categories.");
  type PickerCompany = { name: string; origin: Origin; logo_path: string; origins: { name: string; flag: string } | { name: string; flag: string }[] | null };
  const rows = (data ?? []).map((row) => {
    const company = first(row.companies as PickerCompany | PickerCompany[] | null);
    const companyId = typeof row.company_id === "string" ? row.company_id : "";
    const origin = first(company?.origins ?? null);
    const released = typeof row.released_on === "string" ? new Date(`${row.released_on}T00:00:00Z`) : null;
    return {
      model: {
        id: row.id as string,
        name: row.name as string,
        companyName: company?.name ?? companyId,
        logoUrl: presentLogo((row.logo_path as string | null) || company?.logo_path || "", companyId),
        enabled: Boolean(row.enabled),
        // A model that was never enabled may have no release date. Zero hides the year.
        year: released ? released.getUTCFullYear() : 0,
        sizeName: sizeLabel(row.size as Size),
        originName: origin?.name ?? (company ? originLabel(company.origin) : ""),
        originFlag: origin?.flag ?? (company ? originFlag(company.origin) : ""),
      },
      companyId,
      categoryIds: membershipIds(row.model_categories),
    };
  });
  const counts = enabledModelCounts(
    rows.map((row) => ({ enabled: row.model.enabled, companyId: row.companyId, categoryIds: row.categoryIds })),
  );
  return {
    categories: categories.map((row) => ({
      ...row,
      modelCount: counts.byCategory.get(row.id) ?? 0,
      modelIds: rows.filter((item) => item.categoryIds.includes(row.id)).map((item) => item.model.id),
    })),
    companies,
    models: rows.map((row) => row.model),
  };
}

export async function loadCompanyList(): Promise<CompanyListRow[]> {
  await requireOwner();
  const client = serviceOrThrow();
  const [companies, counts] = await Promise.all([loadCompanies(client), loadEnabledCounts(client)]);
  if (!companies || !counts) throw new Error("Could not read companies.");
  return companies.map((company) => ({ ...company, modelCount: counts.byCompany.get(company.id) ?? 0 }));
}

type CategoryInput = {
  id?: string;
  name?: string;
  description?: string;
  companyId?: string;
  emoji?: string;
  image?: File | null;
  removeIcon?: boolean;
  modelIds?: string[];
};

export async function createCategory(raw: CategoryInput): Promise<CategoryNotice | null> {
  await requireOwner();
  const fields = parseCategoryFields(raw);
  if (!fields) return "invalid";
  const id = categoryIdFromName(fields.name);
  const modelIds = parseModelIds(raw.modelIds ?? []);
  if (!id || !modelIds) return "invalid";
  const client = serviceOrThrow();
  const unknown = await unknownModels(client, modelIds);
  if (unknown) return unknown;
  const icon = await resolveIcon(client, id, raw, null);
  if (typeof icon === "string") return icon;
  const { error } = await client.from("categories").insert({
    id,
    name: fields.name,
    description: fields.description,
    icon_kind: icon.kind,
    icon_value: icon.value,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (icon.uploaded) await removeStoredImage(client, icon.value);
    return error.code === "23505" ? "taken" : "save";
  }
  const linked = await setCategoryModels(client, id, [], modelIds);
  if (linked) {
    // No half state: a category whose links failed is taken back out, with its image.
    await client.from("categories").delete().eq("id", id);
    if (icon.uploaded) await removeStoredImage(client, icon.value);
    return linked;
  }
  return null;
}

export async function updateCategory(raw: CategoryInput): Promise<CategoryNotice | null> {
  await requireOwner();
  const id = categoryIdFromName(raw.id ?? "") ? raw.id?.trim() : null;
  const fields = parseCategoryFields(raw);
  const modelIds = parseModelIds(raw.modelIds ?? []);
  if (!id || !/^[a-z0-9-]{2,48}$/.test(id) || !fields || !modelIds) return "invalid";
  const client = serviceOrThrow();
  const unknown = await unknownModels(client, modelIds);
  if (unknown) return unknown;
  const { data: current, error: readError } = await client
    .from("categories")
    .select("icon_kind, icon_value")
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) return "save";
  const stored = current.icon_kind === "image" ? (current.icon_value as string) : null;
  const icon = await resolveIcon(client, id, raw, { kind: current.icon_kind as string, value: current.icon_value as string });
  if (typeof icon === "string") return icon;
  const { error } = await client
    .from("categories")
    .update({
      name: fields.name,
      description: fields.description,
      icon_kind: icon.kind,
      icon_value: icon.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    if (icon.uploaded) await removeStoredImage(client, icon.value);
    return error.code === "23505" ? "taken" : "save";
  }
  if (stored && stored !== icon.value) await removeStoredImage(client, stored);
  const linked = await readCategoryModelIds(client, id);
  if (!linked) return "save";
  return setCategoryModels(client, id, linked, modelIds);
}

export async function setCategoryEnabled(idRaw: string, enabled: boolean): Promise<CategoryNotice | null> {
  await requireOwner();
  const id = parseCategoryId(idRaw);
  if (!id) return "save";
  const client = serviceOrThrow();
  const { error } = await client
    .from("categories")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? "save" : null;
}

type ResolvedIcon = { kind: string; value: string; uploaded: boolean };

/** The icon to store, by the order in `chooseCategoryIcon`. An upload goes to the logos bucket. */
async function resolveIcon(
  client: SupabaseClient,
  categoryId: string,
  raw: CategoryInput,
  stored: { kind: string; value: string } | null,
): Promise<ResolvedIcon | CategoryNotice> {
  const hasImage = Boolean(raw.image && raw.image.size > 0);
  const choice = chooseCategoryIcon({
    hasImage,
    emoji: raw.emoji,
    companyId: raw.companyId,
    removeCurrent: raw.removeIcon,
    stored,
  });
  if (!choice) return "icon";
  if (choice.kind === "company") {
    const company = await knownCompany(client, choice.value);
    if (company) return company;
  }
  if (choice.kind !== "image" || choice.value !== null) {
    return { kind: choice.kind, value: choice.value ?? "", uploaded: false };
  }
  const bytes = new Uint8Array(await raw.image!.arrayBuffer());
  const found = readLogo(bytes);
  if (!found) return "icon";
  const path = categoryImagePath(categoryId, found.ext, randomBytes(4).toString("hex"));
  const { error } = await client.storage.from("logos").upload(path, new Blob([bytes as BlobPart], { type: found.mime }), {
    contentType: found.mime,
    cacheControl: publicImageCacheControl,
  });
  if (error) return "save";
  return { kind: "image", value: path, uploaded: true };
}

async function removeStoredImage(client: SupabaseClient, path: string) {
  await client.storage.from("logos").remove([logoBucketPath(path)]);
}

async function knownCompany(client: SupabaseClient, companyId: string | null): Promise<CategoryNotice | null> {
  if (!companyId) return "company";
  const { data, error } = await client.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (error) return "save";
  if (!data) return "company";
  return null;
}

async function loadCategories(client: SupabaseClient): Promise<CategoryRow[] | null> {
  return loadCategoryEntries(client);
}

async function replaceModelCategories(client: SupabaseClient, modelId: string, categoryIds: string[]): Promise<RosterNotice | null> {
  if (categoryIds.length > 0) {
    const { data, error } = await client.from("categories").select("id").in("id", categoryIds);
    if (error) return "save";
    if ((data ?? []).length !== categoryIds.length) return "categories";
  }
  const removed = await client.from("model_categories").delete().eq("model_id", modelId);
  if (removed.error) return "save";
  if (categoryIds.length === 0) return null;
  const inserted = await client.from("model_categories").insert(categoryIds.map((categoryId) => ({ model_id: modelId, category_id: categoryId })));
  if (inserted.error) return "save";
  return null;
}

async function unknownModels(client: SupabaseClient, modelIds: string[]): Promise<CategoryNotice | null> {
  if (modelIds.length === 0) return null;
  const { data, error } = await client.from("models").select("id").in("id", modelIds);
  if (error) return "save";
  return (data ?? []).length === modelIds.length ? null : "models";
}

async function readCategoryModelIds(client: SupabaseClient, categoryId: string): Promise<string[] | null> {
  const { data, error } = await client.from("model_categories").select("model_id").eq("category_id", categoryId);
  if (error) return null;
  return (data ?? []).map((row) => row.model_id as string);
}

/** Only the links that changed are written, so a save with the same models touches no row. */
async function setCategoryModels(
  client: SupabaseClient,
  categoryId: string,
  current: string[],
  wanted: string[],
): Promise<CategoryNotice | null> {
  const { add, remove } = diffModelIds(current, wanted);
  if (remove.length > 0) {
    const removed = await client.from("model_categories").delete().eq("category_id", categoryId).in("model_id", remove);
    if (removed.error) return "save";
  }
  if (add.length > 0) {
    const inserted = await client
      .from("model_categories")
      .insert(add.map((modelId) => ({ model_id: modelId, category_id: categoryId })));
    if (inserted.error) return "save";
  }
  return null;
}

function membershipIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || !("category_id" in row)) return [];
    const id = (row as { category_id?: unknown }).category_id;
    return typeof id === "string" ? [id] : [];
  });
}

async function headCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error("Could not read stats.");
  return count ?? 0;
}

async function countPlayers(client: SupabaseClient): Promise<number> {
  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await client.from("games").select("user_id").range(from, from + 999);
    if (error) throw new Error("Could not read stats.");
    for (const row of data ?? []) {
      const id = countedPlayerId(row.user_id);
      if (id) ids.add(id);
    }
    if (!data || data.length < 1000) break;
  }
  return ids.size;
}

function utcDayStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
