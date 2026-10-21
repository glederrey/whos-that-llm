import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "./admin-access";
import {
  categoryDeleteMessage,
  categoryIdFromName,
  parseCategoryFields,
  parseCategoryId,
  parseCategoryIds,
  type CategoryNotice,
} from "./admin-category";
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
import type { Region, Size } from "./game";
import type { CategoryRow, RosterRow } from "./roster-row";

export type { CategoryRow, RosterRow } from "./roster-row";
import { readListPrice } from "./list-price";
import { planReasoningUpdates, type CatalogModel } from "./roster-sync";
import { companyLogoPath } from "./logos";
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

type CompanyRow = { id: string; name: string; region: Region };

export type CategoryListRow = CategoryRow & { modelCount: number };
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
      .select("id, openrouter_id, name, size, difficulty, released_on, enabled, available, input_usd_per_mtok, output_usd_per_mtok, logo_path, company_id, companies(name, region, logo_path), model_categories(category_id)")
      .order("enabled", { ascending: false })
      .order("name"),
    loadCompanies(client),
    loadCategories(client),
  ]);
  if (error || !companies || !categories) throw new Error("Could not read the roster.");
  const categoryName = new Map(categories.map((item) => [item.id, item.name]));
  const rows: RosterRow[] = (data ?? []).map((row) => {
    const company = first(row.companies as { name: string; region: Region; logo_path: string } | { name: string; region: Region; logo_path: string }[] | null);
    const companyId = row.company_id as string;
    const categoryIds = membershipIds(row.model_categories);
    return {
      id: row.id as string,
      openrouterId: row.openrouter_id as string,
      name: row.name as string,
      companyName: company?.name ?? companyId,
      region: company?.region ?? "us",
      year: String(row.released_on ?? "").slice(0, 4),
      size: row.size as Size,
      difficulty: difficultyFromStored(row.difficulty),
      inputUsdPerMtok: readListPrice(row.input_usd_per_mtok),
      outputUsdPerMtok: readListPrice(row.output_usd_per_mtok),
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
  region?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: string;
  inputPrice?: string;
  outputPrice?: string;
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
  const company = await resolveCompany(client, fields.company, fields.region);
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
    input_usd_per_mtok: fields.inputUsdPerMtok,
    output_usd_per_mtok: fields.outputUsdPerMtok,
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
  region?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: string;
  inputPrice?: string;
  outputPrice?: string;
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
  const company = await resolveCompany(client, fields.company, fields.region);
  if (typeof company === "string") return company;
  const patch: Record<string, unknown> = {
    openrouter_id: fields.openrouterId,
    name: fields.name,
    company_id: company.id,
    size: fields.size,
    difficulty: difficultyNumber[fields.difficulty],
    released_on: fields.releasedOn ?? releasedOnForYear(current.data.released_on as string | null, fields.year),
    input_usd_per_mtok: fields.inputUsdPerMtok,
    output_usd_per_mtok: fields.outputUsdPerMtok,
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

export async function writeRosterPrices(
  updates: { id: string; inputUsdPerMtok: number; outputUsdPerMtok: number }[],
): Promise<boolean> {
  await requireOwner();
  if (updates.length === 0) return true;
  const rows: { id: string; inputUsdPerMtok: number; outputUsdPerMtok: number }[] = [];
  for (const update of updates) {
    const id = parseModelId(update.id);
    if (!id || !Number.isFinite(update.inputUsdPerMtok) || !Number.isFinite(update.outputUsdPerMtok)) return false;
    rows.push({ id, inputUsdPerMtok: update.inputUsdPerMtok, outputUsdPerMtok: update.outputUsdPerMtok });
  }
  const client = serviceOrThrow();
  for (const row of rows) {
    const { error } = await client
      .from("models")
      .update({
        input_usd_per_mtok: row.inputUsdPerMtok,
        output_usd_per_mtok: row.outputUsdPerMtok,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return false;
  }
  return true;
}

export async function writeReasoningFlags(catalog: CatalogModel[]): Promise<boolean> {
  await requireOwner();
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

export async function insertDiscoveredModels(
  models: {
    id: string;
    name: string;
    releasedOn: string | null;
    inputUsdPerMtok: number | null;
    outputUsdPerMtok: number | null;
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
      input_usd_per_mtok: finitePrice(model.inputUsdPerMtok),
      output_usd_per_mtok: finitePrice(model.outputUsdPerMtok),
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

function finitePrice(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function resolveCompany(client: SupabaseClient, name: string, region: Region): Promise<CompanyRow | RosterNotice> {
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
      region,
      logo_path: companyLogoPath(id),
    });
    if (error) return "save";
    return { id, name: trimmed, region };
  }
  if (existing.region !== region) {
    const { error } = await client.from("companies").update({ region }).eq("id", existing.id);
    if (error) return "save";
    existing.region = region;
  }
  return existing;
}

async function loadCompanies(client: SupabaseClient): Promise<CompanyRow[] | null> {
  const { data, error } = await client.from("companies").select("id, name, region").order("name");
  if (error) return null;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    region: row.region as Region,
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

export async function loadCategoryList(): Promise<{ categories: CategoryListRow[]; companies: CompanyRow[] }> {
  await requireOwner();
  const client = serviceOrThrow();
  const [categories, companies, counts] = await Promise.all([
    loadCategories(client),
    loadCompanies(client),
    loadEnabledCounts(client),
  ]);
  if (!categories || !companies || !counts) throw new Error("Could not read categories.");
  return {
    categories: categories.map((row) => ({ ...row, modelCount: counts.byCategory.get(row.id) ?? 0 })),
    companies,
  };
}

export async function loadCompanyList(): Promise<CompanyListRow[]> {
  await requireOwner();
  const client = serviceOrThrow();
  const [companies, counts] = await Promise.all([loadCompanies(client), loadEnabledCounts(client)]);
  if (!companies || !counts) throw new Error("Could not read companies.");
  return companies.map((company) => ({ ...company, modelCount: counts.byCompany.get(company.id) ?? 0 }));
}

export async function createCategory(raw: {
  name?: string;
  description?: string;
  companyId?: string;
}): Promise<CategoryNotice | null> {
  await requireOwner();
  const fields = parseCategoryFields(raw);
  if (!fields) return "invalid";
  const id = categoryIdFromName(fields.name);
  if (!id) return "invalid";
  const client = serviceOrThrow();
  const company = await knownCompany(client, fields.companyId);
  if (company) return company;
  const { error } = await client.from("categories").insert({
    id,
    name: fields.name,
    description: fields.description,
    company_id: fields.companyId,
    updated_at: new Date().toISOString(),
  });
  if (error?.code === "23505") return "taken";
  if (error?.code === "23503") return "company";
  if (error) return "save";
  return null;
}

export async function updateCategory(raw: {
  id?: string;
  name?: string;
  description?: string;
  companyId?: string;
}): Promise<CategoryNotice | null> {
  await requireOwner();
  const id = categoryIdFromName(raw.id ?? "") ? raw.id?.trim() : null;
  const fields = parseCategoryFields(raw);
  if (!id || !/^[a-z0-9-]{2,48}$/.test(id) || !fields) return "invalid";
  const client = serviceOrThrow();
  const company = await knownCompany(client, fields.companyId);
  if (company) return company;
  const { error } = await client
    .from("categories")
    .update({
      name: fields.name,
      description: fields.description,
      company_id: fields.companyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error?.code === "23505") return "taken";
  if (error?.code === "23503") return "company";
  if (error) return "save";
  return null;
}

export async function removeCategory(idRaw: string): Promise<string | null> {
  await requireOwner();
  const id = parseCategoryId(idRaw);
  if (!id) return "Could not delete that category.";
  const client = serviceOrThrow();
  // model_categories.category_id cascades, so the links go and the models stay.
  const { error } = await client.from("categories").delete().eq("id", id);
  if (!error) return null;
  return categoryDeleteMessage(error.message) ?? "Could not delete that category.";
}

async function knownCompany(client: SupabaseClient, companyId: string | null): Promise<CategoryNotice | null> {
  if (!companyId) return null;
  const { data, error } = await client.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (error) return "save";
  if (!data) return "company";
  return null;
}

async function loadCategories(client: SupabaseClient): Promise<CategoryRow[] | null> {
  const { data, error } = await client
    .from("categories")
    .select("id, name, description, company_id, companies(name)")
    .order("name");
  if (error) return null;
  return (data ?? []).map((row) => {
    const company = first(row.companies as { name: string } | { name: string }[] | null);
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      companyId: (row.company_id as string | null) ?? null,
      companyName: company?.name ?? null,
    };
  });
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
