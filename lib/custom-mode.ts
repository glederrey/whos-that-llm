import type { PickerModel } from "./admin-category";

/** A model in the Custom picker: what the player needs to choose it. Origin is the company's. */
export type CustomModel = PickerModel & { year: number; sizeName: string; originName: string; originFlag: string };

/** Most models one Custom round can hold. The body of a request has no size limit of its own. */
export const maxCustomModels = 200;

export const minCustomModels = 2;

/** Model ids in the shape the roster uses. */
const modelIdShape = /^[a-z0-9][a-z0-9._:-]{0,99}$/;

/**
 * The model ids a Custom start request names: a list of id-shaped strings, without repeats.
 * Anything else, or more than `maxCustomModels` ids, is not a list at all.
 */
export function parseCustomModelIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > maxCustomModels) return null;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !modelIdShape.test(item)) return null;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids;
}
