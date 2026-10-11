import type { Region, Size } from "./game";

export type RosterNotice = "invalid" | "duplicate" | "taken" | "year" | "reasoning" | "classes" | "save";

const notices: Record<RosterNotice, string> = {
  invalid: "Check the OpenRouter id, name, company, region, release date, size, and prices.",
  duplicate: "That OpenRouter id is already on a model.",
  taken: "That model is already in the roster.",
  year: "Add a year before turning this model on.",
  reasoning: "This model needs provider settings before it can be turned on.",
  classes: "Pick classes from the list.",
  save: "Could not save that model.",
};

export function hasAdminFlag(user: { app_metadata?: object | null } | null | undefined): boolean {
  const metadata = user?.app_metadata;
  if (!metadata) return false;
  return (metadata as { admin?: unknown }).admin === true;
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
  if (text === "nano" || text === "small" || text === "medium" || text === "large" || text === "xxl") return text;
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

export function parseReleasedOn(value: string): string | null {
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (year < 2010 || year > 2100) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return null;
  return text;
}

/** Empty is null. A typed number is kept as typed. Anything else is invalid. */
export function parsePriceInput(value: string | undefined): number | null | undefined {
  const text = (value ?? "").trim().replace(/^\$/, "");
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  releasedOn: string | null;
  size: Size;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
};

export function parseModelFields(raw: {
  openrouterId?: string;
  name?: string;
  company?: string;
  region?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  inputPrice?: string;
  outputPrice?: string;
}): ModelFields | null {
  const openrouterId = raw.openrouterId?.trim() ?? "";
  const name = raw.name?.trim() ?? "";
  const company = raw.company?.trim() ?? "";
  if (!validOpenRouterId(openrouterId)) return null;
  if (name.length < 1 || name.length > 80) return null;
  if (!companyIdFromName(company)) return null;
  const region = parseRegion(raw.region ?? "");
  const releasedOn = raw.releasedOn?.trim() ? parseReleasedOn(raw.releasedOn) : null;
  if (raw.releasedOn?.trim() && !releasedOn) return null;
  const year = releasedOn ? Number(releasedOn.slice(0, 4)) : parseYear(raw.year ?? "");
  const size = parseSize(raw.size ?? "");
  const inputUsdPerMtok = parsePriceInput(raw.inputPrice);
  const outputUsdPerMtok = parsePriceInput(raw.outputPrice);
  if (!region || year === null || !size || inputUsdPerMtok === undefined || outputUsdPerMtok === undefined) return null;
  return { openrouterId, name, company, region, year, releasedOn, size, inputUsdPerMtok, outputUsdPerMtok };
}

export function rosterNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as RosterNotice];
}
