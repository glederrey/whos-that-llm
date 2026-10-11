import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "./admin-access";
import { classIdFromName, parseClassFields, parseClassIds, type ClassNotice } from "./admin-class";
import {
  canTurnOn,
  companyIdFromName,
  modelIdFromOpenRouter,
  parseModelFields,
  parseModelId,
  releasedOnForYear,
  type RosterNotice,
} from "./admin-model";
import { difficultyFromStored, difficultyNumber, type Difficulty } from "./difficulty";
import type { Region, Size } from "./game";
import { readListPrice } from "./list-price";
import { companyLogoPath } from "./logos";
import { countedPlayerId } from "./anonymize-account";
import { presentLogo, serviceOrThrow } from "./rounds";

export type RosterRow = {
  id: string;
  openrouterId: string;
  name: string;
  companyName: string;
  region: Region;
  year: string;
  size: Size;
  difficulty: Difficulty | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  enabled: boolean;
  logoUrl: string;
  classIds: string[];
  classNames: string;
};

export type ClassRow = {
  id: string;
  name: string;
  description: string;
  companyId: string | null;
  companyName: string | null;
};

export type AdminStats = {
  roster: number;
  active: number;
  players: number;
  gamesToday: number;
  games: number;
};

type CompanyRow = { id: string; name: string; region: Region };

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

export async function loadRoster(): Promise<{ rows: RosterRow[]; companies: CompanyRow[]; classes: ClassRow[] }> {
  await requireOwner();
  const client = serviceOrThrow();
  const [{ data, error }, companies, classes] = await Promise.all([
    client
      .from("models")
      .select("id, openrouter_id, name, size, difficulty, released_on, enabled, input_usd_per_mtok, output_usd_per_mtok, logo_path, company_id, companies(name, region, logo_path), model_classes(class_id)")
      .order("enabled", { ascending: false })
      .order("name"),
    loadCompanies(client),
    loadClasses(client),
  ]);
  if (error || !companies || !classes) throw new Error("Could not read the roster.");
  const className = new Map(classes.map((item) => [item.id, item.name]));
  const rows: RosterRow[] = (data ?? []).map((row) => {
    const company = first(row.companies as { name: string; region: Region; logo_path: string } | { name: string; region: Region; logo_path: string }[] | null);
    const companyId = row.company_id as string;
    const classIds = membershipIds(row.model_classes);
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
      logoUrl: presentLogo((row.logo_path as string | null) || company?.logo_path || "", companyId),
      classIds,
      classNames: classIds.map((id) => className.get(id) ?? id).join(", "),
    };
  });
  return { rows, companies, classes };
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
  classIds?: string[];
}): Promise<RosterNotice | null> {
  await requireOwner();
  const fields = parseModelFields(raw);
  const classIds = parseClassIds(raw.classIds ?? []);
  if (!fields || !classIds) return "invalid";
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
  return replaceModelClasses(client, id, classIds);
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
  classIds?: string[];
}): Promise<RosterNotice | null> {
  await requireOwner();
  const id = parseModelId(raw.id ?? "");
  const fields = parseModelFields(raw);
  const classIds = parseClassIds(raw.classIds ?? []);
  if (!id || !fields || !classIds) return "invalid";
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
  return replaceModelClasses(client, id, classIds);
}

export async function setRosterEnabled(idRaw: string, enabled: boolean): Promise<RosterNotice | null> {
  await requireOwner();
  const id = parseModelId(idRaw);
  if (!id) return "save";
  const client = serviceOrThrow();
  const current = await client
    .from("models")
    .select("id, released_on, reasoning, provider_settings")
    .eq("id", id)
    .maybeSingle();
  if (current.error || !current.data) return "save";
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

export async function loadClassList(): Promise<{ classes: ClassRow[]; companies: CompanyRow[] }> {
  await requireOwner();
  const client = serviceOrThrow();
  const [classes, companies] = await Promise.all([loadClasses(client), loadCompanies(client)]);
  if (!classes || !companies) throw new Error("Could not read classes.");
  return { classes, companies };
}

export async function createClass(raw: {
  name?: string;
  description?: string;
  companyId?: string;
}): Promise<ClassNotice | null> {
  await requireOwner();
  const fields = parseClassFields(raw);
  if (!fields) return "invalid";
  const id = classIdFromName(fields.name);
  if (!id) return "invalid";
  const client = serviceOrThrow();
  const company = await knownCompany(client, fields.companyId);
  if (company) return company;
  const { error } = await client.from("classes").insert({
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

export async function updateClass(raw: {
  id?: string;
  name?: string;
  description?: string;
  companyId?: string;
}): Promise<ClassNotice | null> {
  await requireOwner();
  const id = classIdFromName(raw.id ?? "") ? raw.id?.trim() : null;
  const fields = parseClassFields(raw);
  if (!id || !/^[a-z0-9-]{2,48}$/.test(id) || !fields) return "invalid";
  const client = serviceOrThrow();
  const company = await knownCompany(client, fields.companyId);
  if (company) return company;
  const { error } = await client
    .from("classes")
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

async function knownCompany(client: SupabaseClient, companyId: string | null): Promise<ClassNotice | null> {
  if (!companyId) return null;
  const { data, error } = await client.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (error) return "save";
  if (!data) return "company";
  return null;
}

async function loadClasses(client: SupabaseClient): Promise<ClassRow[] | null> {
  const { data, error } = await client
    .from("classes")
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

async function replaceModelClasses(client: SupabaseClient, modelId: string, classIds: string[]): Promise<RosterNotice | null> {
  if (classIds.length > 0) {
    const { data, error } = await client.from("classes").select("id").in("id", classIds);
    if (error) return "save";
    if ((data ?? []).length !== classIds.length) return "classes";
  }
  const removed = await client.from("model_classes").delete().eq("model_id", modelId);
  if (removed.error) return "save";
  if (classIds.length === 0) return null;
  const inserted = await client.from("model_classes").insert(classIds.map((classId) => ({ model_id: modelId, class_id: classId })));
  if (inserted.error) return "save";
  return null;
}

function membershipIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || !("class_id" in row)) return [];
    const id = (row as { class_id?: unknown }).class_id;
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

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}
