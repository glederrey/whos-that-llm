export type ClassFields = {
  name: string;
  description: string;
  companyId: string | null;
};

export type ClassNotice = "invalid" | "taken" | "company" | "save";

const notices: Record<ClassNotice, string> = {
  invalid: "Check the name and the description.",
  taken: "That class name is already in the list.",
  company: "Pick a company from the list, or leave it blank.",
  save: "Could not save that class.",
};

export function classIdFromName(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9-]{2,48}$/.test(slug)) return null;
  return slug;
}

export function parseClassFields(raw: {
  name?: string;
  description?: string;
  companyId?: string;
}): ClassFields | null {
  const name = raw.name?.trim() ?? "";
  const description = raw.description?.trim() ?? "";
  if (name.length < 1 || name.length > 80) return null;
  if (description.length > 500) return null;
  if (!classIdFromName(name)) return null;
  const companyId = raw.companyId?.trim() ?? "";
  if (companyId && !/^[a-z0-9-]{2,32}$/.test(companyId)) return null;
  return { name, description, companyId: companyId || null };
}

export function parseClassIds(values: string[]): string[] | null {
  const ids: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id) continue;
    if (!/^[a-z0-9-]{2,48}$/.test(id)) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function classNotice(code: string | undefined): string | null {
  if (!code || !(code in notices)) return null;
  return notices[code as ClassNotice];
}
