export type CategoryIconKind = "company" | "image" | "emoji";

/** `iconValue` is null for `image`: the upload, or the file already stored, supplies it. */
export type CategoryFields = {
  name: string;
  description: string;
  iconKind: CategoryIconKind;
  iconValue: string | null;
};

export type CategoryNotice = "invalid" | "taken" | "company" | "icon" | "save";

export const maxCategoryDescription = 140;

const notices: Record<CategoryNotice, string> = {
  invalid: "Check the name and the description.",
  taken: "That category name is already in the list.",
  company: "Pick a company from the list.",
  icon: "Pick a company logo, upload an SVG, PNG, or WebP under 1 MB, or type one emoji.",
  save: "Could not save that category.",
};

export function categoryIdFromName(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9-]{2,48}$/.test(slug)) return null;
  return slug;
}

export function parseCategoryId(value: string): string | null {
  const id = value.trim();
  if (!/^[a-z0-9-]{2,48}$/.test(id)) return null;
  return id;
}

export function categoryDeleteMessage(message: string | undefined): string | null {
  const cleaned = message?.replace(/\s+/g, " ").trim() ?? "";
  if (!cleaned) return null;
  return cleaned.slice(0, 240);
}

/** One emoji: a single grapheme that holds a pictograph or a flag. */
export function parseEmoji(value: string | undefined): string | null {
  const emoji = value?.trim() ?? "";
  if (!emoji || emoji.length > 32) return null;
  const parts = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(emoji)];
  if (parts.length !== 1) return null;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji) ? emoji : null;
}

export function parseCategoryFields(raw: {
  name?: string;
  description?: string;
  iconKind?: string;
  companyId?: string;
  emoji?: string;
}): CategoryFields | null {
  const name = raw.name?.trim() ?? "";
  const description = raw.description?.trim() ?? "";
  if (name.length < 1 || name.length > 80) return null;
  if (description.length > maxCategoryDescription) return null;
  if (!categoryIdFromName(name)) return null;
  if (raw.iconKind === "company") {
    const companyId = raw.companyId?.trim() ?? "";
    if (!/^[a-z0-9-]{2,32}$/.test(companyId)) return null;
    return { name, description, iconKind: "company", iconValue: companyId };
  }
  if (raw.iconKind === "emoji") {
    const emoji = parseEmoji(raw.emoji);
    return emoji ? { name, description, iconKind: "emoji", iconValue: emoji } : null;
  }
  if (raw.iconKind === "image") return { name, description, iconKind: "image", iconValue: null };
  return null;
}

export function parseCategoryIds(values: string[]): string[] | null {
  const ids: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id) continue;
    if (!/^[a-z0-9-]{2,48}$/.test(id)) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function categoryNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as CategoryNotice];
}
