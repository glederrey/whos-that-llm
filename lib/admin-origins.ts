import "server-only";

import { requireOwner } from "./admin-access";
import { originIdFromName, parseOriginFields, parseOriginId, type OriginNotice, type OriginOption } from "./admin-origin";
import { serviceOrThrow } from "./rounds";

export type OriginRow = OriginOption & { sortOrder: number; enabled: boolean; companies: number };

/** Every origin in the order the Origin buttons use. The model forms read it for their origin select. */
export async function loadOriginOptions(): Promise<OriginOption[]> {
  await requireOwner();
  const { data, error } = await serviceOrThrow()
    .from("origins")
    .select("id, name, flag")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string, flag: row.flag as string }));
}

export async function loadOriginList(): Promise<OriginRow[]> {
  await requireOwner();
  const client = serviceOrThrow();
  const [origins, companies] = await Promise.all([
    client.from("origins").select("id, name, flag, sort_order, enabled").order("sort_order").order("name"),
    client.from("companies").select("origin"),
  ]);
  if (origins.error) throw new Error(origins.error.message);
  if (companies.error) throw new Error(companies.error.message);
  const counts = new Map<string, number>();
  for (const row of companies.data ?? []) counts.set(row.origin as string, (counts.get(row.origin as string) ?? 0) + 1);
  return (origins.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    flag: row.flag as string,
    sortOrder: Number(row.sort_order),
    enabled: Boolean(row.enabled),
    companies: counts.get(row.id as string) ?? 0,
  }));
}

export async function createOrigin(raw: { name?: string; flag?: string; sortOrder?: string }): Promise<OriginNotice | null> {
  await requireOwner();
  const fields = parseOriginFields(raw);
  const id = originIdFromName(raw.name ?? "");
  if (!fields || !id) return "invalid";
  const { error } = await serviceOrThrow()
    .from("origins")
    .insert({ id, name: fields.name, flag: fields.flag, sort_order: fields.sortOrder });
  if (error) return error.code === "23505" ? "taken" : "save";
  return null;
}

export async function updateOrigin(raw: { id?: string; name?: string; flag?: string; sortOrder?: string }): Promise<OriginNotice | null> {
  await requireOwner();
  const id = parseOriginId(raw.id ?? "");
  const fields = parseOriginFields(raw);
  if (!id || !fields) return "invalid";
  const { error } = await serviceOrThrow()
    .from("origins")
    .update({ name: fields.name, flag: fields.flag, sort_order: fields.sortOrder })
    .eq("id", id);
  return error ? "save" : null;
}

/** Turns an origin on or off. Off, it has no button and no model in Origin mode; the other modes do not change. */
export async function setOriginEnabled(idRaw: string, enabled: boolean): Promise<OriginNotice | null> {
  await requireOwner();
  const id = parseOriginId(idRaw);
  if (!id) return "invalid";
  const { error } = await serviceOrThrow().from("origins").update({ enabled }).eq("id", id);
  return error ? "save" : null;
}
