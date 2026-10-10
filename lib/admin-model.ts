import type { Region, Size } from "./game";

export type RosterNotice = "invalid" | "duplicate" | "taken" | "year" | "reasoning" | "save";

const notices: Record<RosterNotice, string> = {
  invalid: "Check the OpenRouter id, name, company, region, year, and size.",
  duplicate: "That OpenRouter id is already on a model.",
  taken: "That model is already in the roster.",
  year: "Add a year before turning this model on.",
  reasoning: "This model needs provider settings before it can be turned on.",
  save: "Could not save that model.",
};

export function emailsMatch(session: string | null | undefined, owner: string): boolean {
  const left = session?.trim().toLowerCase() ?? "";
  const right = owner.trim().toLowerCase();
  return left.length > 0 && right.length > 0 && left === right;
}

export function validOpenRouterId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 200 && /^[^\s/]+\/[^\s/]+$/.test(trimmed);
}

export function modelIdFromOpenRouter(openrouterId: string): string | null {
  if (!validOpenRouterId(openrouterId)) return null;
  const tail = openrouterId.trim().slice(openrouterId.trim().lastIndexOf("/") + 1);
  const slug = tail.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return null;
  return slug;
}

export function companyIdFromName(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) return null;
  return slug;
}

export function parseModelId(value: string): string | null {
  return /^[a-z0-9-]{2,64}$/.test(value) ? value : null;
}

export function parseRegion(value: string): Region | null {
  const text = value.trim().toLowerCase();
  if (text === "us" || text === "usa") return "us";
  if (text === "cn" || text === "china") return "cn";
  if (text === "eu" || text === "europe") return "eu";
  return null;
}

export function parseSize(value: string): Size | null {
  const text = value.trim().toLowerCase();
  if (text === "small" || text === "medium" || text === "large") return text;
  return null;
}

export function parseYear(value: string): number | null {
  if (!/^\d{4}$/.test(value.trim())) return null;
  const year = Number(value.trim());
  if (year < 2010 || year > 2100) return null;
  return year;
}

export function yearOf(value: string | null): string {
  return value?.match(/^(\d{4})/)?.[1] ?? "";
}

export function releasedOnForYear(previous: string | null, year: number): string {
  const match = previous?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && Number(match[1]) === year) return `${match[1]}-${match[2]}-${match[3]}`;
  if (match) {
    const candidate = `${year}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${candidate}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate) return candidate;
  }
  return `${year}-01-01`;
}

export function settingsEmpty(value: unknown): boolean {
  return value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);
}

export function canTurnOn(input: { releasedOn: string | null; reasoning: boolean; providerSettings: unknown }): boolean {
  if (!input.releasedOn) return false;
  if (input.reasoning && settingsEmpty(input.providerSettings)) return false;
  return true;
}

export type ModelFields = {
  openrouterId: string;
  name: string;
  company: string;
  region: Region;
  year: number;
  size: Size;
};

export function parseModelFields(raw: {
  openrouterId?: string;
  name?: string;
  company?: string;
  region?: string;
  year?: string;
  size?: string;
}): ModelFields | null {
  const openrouterId = raw.openrouterId?.trim() ?? "";
  const name = raw.name?.trim() ?? "";
  const company = raw.company?.trim() ?? "";
  if (!validOpenRouterId(openrouterId)) return null;
  if (name.length < 1 || name.length > 80) return null;
  if (!companyIdFromName(company)) return null;
  const region = parseRegion(raw.region ?? "");
  const year = parseYear(raw.year ?? "");
  const size = parseSize(raw.size ?? "");
  if (!region || year === null || !size) return null;
  return { openrouterId, name, company, region, year, size };
}

export function rosterNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as RosterNotice];
}
