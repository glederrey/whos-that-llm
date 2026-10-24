import { parseEmoji } from "./admin-category";

export type OriginNotice = "invalid" | "taken" | "save";

/** One origin as the company form and the Origin buttons offer it. */
export type OriginOption = { id: string; name: string; flag: string };

export type OriginFields = { name: string; flag: string; sortOrder: number };

export const maxOriginName = 40;

/** A flag typed as a two-letter country code (JP) becomes the flag emoji; anything else must already be one emoji. */
export function parseFlag(value: string | undefined): string | null {
  const typed = (value ?? "").trim();
  if (/^[a-z]{2}$/i.test(typed)) {
    return [...typed.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
  }
  return parseEmoji(typed);
}

const notices: Record<OriginNotice, string> = {
  invalid: "Give a name of up to 40 characters, a two-letter country code like JP (or one flag emoji), and a whole number for the order.",
  taken: "That origin is already in the list.",
  save: "Could not save that origin.",
};

export function originIdFromName(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(slug)) return null;
  return slug;
}

export function parseOriginId(value: string): string | null {
  const id = value.trim();
  return /^[a-z][a-z0-9-]{0,30}$/.test(id) ? id : null;
}

export function parseOriginFields(raw: { name?: string; flag?: string; sortOrder?: string }): OriginFields | null {
  const name = (raw.name ?? "").trim();
  if (name.length === 0 || name.length > maxOriginName) return null;
  const flag = parseFlag(raw.flag);
  if (!flag) return null;
  const order = (raw.sortOrder ?? "").trim();
  const sortOrder = order === "" ? 100 : Number(order);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return null;
  return { name, flag, sortOrder };
}

export function originNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as OriginNotice];
}
