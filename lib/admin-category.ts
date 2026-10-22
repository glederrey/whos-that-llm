export type CategoryIconKind = "company" | "image" | "emoji" | "default";

export type CategoryFields = {
  name: string;
  description: string;
};

/** `value` is null for a new upload: the stored path comes once the file is in the bucket. */
export type CategoryIconChoice = { kind: CategoryIconKind; value: string | null };

export type CategoryNotice = "invalid" | "taken" | "company" | "icon" | "models" | "save";

/** One model in the category form's picker. */
export type PickerModel = { id: string; name: string; companyName: string; logoUrl: string; enabled: boolean };

export const maxCategoryDescription = 140;

const notices: Record<CategoryNotice, string> = {
  invalid: "Check the name and the description.",
  taken: "That category name is already in the list.",
  company: "Pick a company from the list.",
  icon: "Upload an SVG, PNG, or WebP under 1 MB, or type one emoji.",
  models: "Pick models from the list.",
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

/** One emoji: a single grapheme that holds a pictograph or a flag. */
export function parseEmoji(value: string | undefined): string | null {
  const emoji = value?.trim() ?? "";
  if (!emoji || emoji.length > 32) return null;
  const parts = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(emoji)];
  if (parts.length !== 1) return null;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji) ? emoji : null;
}

export function parseCategoryFields(raw: { name?: string; description?: string }): CategoryFields | null {
  const name = raw.name?.trim() ?? "";
  const description = raw.description?.trim() ?? "";
  if (name.length < 1 || name.length > 80) return null;
  if (description.length > maxCategoryDescription) return null;
  if (!categoryIdFromName(name)) return null;
  return { name, description };
}

/**
 * The icon to store, in this order: an uploaded image, the emoji, the image already stored, the company logo,
 * the default logo. Removing the current icon skips the emoji field and the stored image. Null when the emoji
 * or the company id is malformed.
 */
export function chooseCategoryIcon(raw: {
  hasImage: boolean;
  emoji?: string;
  companyId?: string;
  removeCurrent?: boolean;
  stored?: { kind: string; value: string } | null;
}): CategoryIconChoice | null {
  const typed = raw.emoji?.trim() ?? "";
  const emoji = parseEmoji(typed);
  if (typed && !emoji) return null;
  const companyId = raw.companyId?.trim() ?? "";
  if (companyId && !/^[a-z0-9-]{2,32}$/.test(companyId)) return null;
  if (raw.hasImage) return { kind: "image", value: null };
  if (!raw.removeCurrent) {
    if (emoji) return { kind: "emoji", value: emoji };
    if (raw.stored?.kind === "image") return { kind: "image", value: raw.stored.value };
  }
  if (companyId) return { kind: "company", value: companyId };
  return { kind: "default", value: "" };
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

export function parseModelIds(values: string[]): string[] | null {
  const ids: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id) continue;
    if (!/^[a-z0-9-]{2,64}$/.test(id)) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Case-insensitive match on the model name or the company name. An empty query shows every model. */
export function filterPickerModels(models: readonly PickerModel[], query: string): PickerModel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...models];
  return models.filter((model) => model.name.toLowerCase().includes(needle) || model.companyName.toLowerCase().includes(needle));
}

/** The selection plus every shown model, keeping the order already chosen. */
export function selectShown(selected: readonly string[], shown: readonly PickerModel[]): string[] {
  const next = [...selected];
  for (const model of shown) if (!next.includes(model.id)) next.push(model.id);
  return next;
}

/** The links to add and to remove to go from the current model ids to the wanted ones. */
export function diffModelIds(current: readonly string[], wanted: readonly string[]): { add: string[]; remove: string[] } {
  return {
    add: wanted.filter((id) => !current.includes(id)),
    remove: current.filter((id) => !wanted.includes(id)),
  };
}

export function categoryNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as CategoryNotice];
}
