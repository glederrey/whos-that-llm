import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "./admin-access";
import {
  canTurnOn,
  companyIdFromName,
  modelIdFromOpenRouter,
  parseModelFields,
  parseModelId,
  releasedOnForYear,
  type RosterNotice,
} from "./admin-model";
import type { Region, Size } from "./game";
import { companyLogoPath } from "./logos";
import { countedPlayerId } from "./anonymize-account";
import { presentLogo, serviceOrThrow } from "./rounds";

export type RosterRow = {
  id: string;
  openrouterId: string;
  name: string;
  familyName: string;
  companyName: string;
  region: Region;
  year: string;
  size: Size;
  enabled: boolean;
  logoUrl: string;
};

export type NamedRow = { id: string; name: string };

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

export async function loadRoster(): Promise<{ rows: RosterRow[]; companies: CompanyRow[]; families: NamedRow[] }> {
  await requireOwner();
  const client = serviceOrThrow();
  const [{ data, error }, companies, families] = await Promise.all([
    client
      .from("models")
      .select("id, openrouter_id, name, size, released_on, enabled, logo_path, company_id, family_id, companies(name, region, logo_path), families(name)")
      .order("enabled", { ascending: false })
      .order("name"),
    loadCompanies(client),
    loadFamilies(client),
  ]);
  if (error || !companies || !families) throw new Error("Could not read the roster.");
  const rows: RosterRow[] = (data ?? []).map((row) => {
    const company = first(row.companies as { name: string; region: Region; logo_path: string } | { name: string; region: Region; logo_path: string }[] | null);
    const family = first(row.families as { name: string } | { name: string }[] | null);
    const companyId = row.company_id as string;
    return {
      id: row.id as string,
      openrouterId: row.openrouter_id as string,
      name: row.name as string,
      familyName: family?.name ?? (row.family_id as string),
      companyName: company?.name ?? companyId,
      region: company?.region ?? "us",
      year: String(row.released_on ?? "").slice(0, 4),
      size: row.size as Size,
      enabled: Boolean(row.enabled),
      logoUrl: presentLogo((row.logo_path as string | null) || company?.logo_path || "", companyId),
    };
  });
  return { rows, companies, families };
}

export async function createRosterModel(raw: {
  openrouterId?: string;
  name?: string;
  company?: string;
  family?: string;
  region?: string;
  year?: string;
  size?: string;
}): Promise<RosterNotice | null> {
  await requireOwner();
  const fields = parseModelFields(raw);
  if (!fields) return "invalid";
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
  const familyId = await resolveFamily(client, fields.family);
  if (familyId === "invalid" || familyId === "save") return familyId;
  const { error } = await client.from("models").insert({
    id,
    openrouter_id: fields.openrouterId,
    name: fields.name,
    company_id: company.id,
    family_id: familyId,
    size: fields.size,
    open_weights: false,
    reasoning: false,
    provider_settings: {},
    is_latest: false,
    released_on: releasedOnForYear(null, fields.year),
    enabled: false,
    logo_path: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return error.code === "23505" ? "duplicate" : "save";
  return null;
}

export async function updateRosterModel(raw: {
  id?: string;
  openrouterId?: string;
  name?: string;
  company?: string;
  family?: string;
  region?: string;
  year?: string;
  size?: string;
}): Promise<RosterNotice | null> {
  await requireOwner();
  const id = parseModelId(raw.id ?? "");
  const fields = parseModelFields(raw);
  if (!id || !fields) return "invalid";
  const client = serviceOrThrow();
  const current = await client.from("models").select("id, released_on").eq("id", id).maybeSingle();
  if (current.error || !current.data) return "save";
  const duplicate = await client.from("models").select("id").eq("openrouter_id", fields.openrouterId).maybeSingle();
  if (duplicate.error) return "save";
  if (duplicate.data && duplicate.data.id !== id) return "duplicate";
  const company = await resolveCompany(client, fields.company, fields.region);
  if (typeof company === "string") return company;
  const familyId = await resolveFamily(client, fields.family);
  if (familyId === "invalid" || familyId === "save") return familyId;
  const patch: Record<string, unknown> = {
    openrouter_id: fields.openrouterId,
    name: fields.name,
    company_id: company.id,
    family_id: familyId,
    size: fields.size,
    released_on: releasedOnForYear(current.data.released_on as string | null, fields.year),
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("models").update(patch).eq("id", id);
  if (error) return error.code === "23505" ? "duplicate" : "save";
  return null;
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

async function resolveFamily(client: SupabaseClient, name: string): Promise<string | RosterNotice> {
  const id = companyIdFromName(name);
  if (!id) return "invalid";
  const families = await loadFamilies(client);
  if (!families) return "save";
  const trimmed = name.trim();
  const existing = families.find((family) => family.id === id || family.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const { error } = await client.from("families").insert({ id, name: trimmed, enabled: true });
  if (error) return "save";
  return id;
}

async function loadFamilies(client: SupabaseClient): Promise<NamedRow[] | null> {
  const { data, error } = await client.from("families").select("id, name").order("name");
  if (error) return null;
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }));
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
