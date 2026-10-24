import { companyIdFromName } from "./admin-model";
import { parseOriginId } from "./admin-origin";

export type CompanyNotice = "invalid" | "taken" | "logo" | "save";

/** One company as the model form offers it. */
export type CompanyOption = { id: string; name: string };

export type CompanyFields = { name: string; origin: string };

export const maxCompanyName = 60;

const notices: Record<CompanyNotice, string> = {
  invalid: "Give a name of up to 60 characters (letters or digits, at least 2) and pick an origin.",
  taken: "That company is already in the list.",
  logo: "Pick a logo or upload one. Use an SVG, PNG, or WebP under 1 MB.",
  save: "Could not save that company.",
};

export function parseCompanyFields(raw: { name?: string; origin?: string }): CompanyFields | null {
  const name = (raw.name ?? "").trim();
  if (name.length === 0 || name.length > maxCompanyName || !companyIdFromName(name)) return null;
  const origin = parseOriginId(raw.origin ?? "");
  if (!origin) return null;
  return { name, origin };
}

export function companyNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as CompanyNotice];
}
