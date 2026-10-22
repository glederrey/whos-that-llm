"use server";

import { requireOwner } from "@/lib/admin-access";
import { validOpenRouterId } from "@/lib/admin-model";
import { draftFromOpenRouter, type CompanyChoice, type ModelDraft } from "@/lib/openrouter-draft";
import type { Region } from "@/lib/game";
import { serviceOrThrow } from "@/lib/rounds";

export type LookupResult = { ok: true; found: true; draft: ModelDraft } | { ok: true; found: false } | { ok: false };

type CatalogModel = {
  id?: string;
  name?: unknown;
  created?: unknown;
};

export async function lookupOpenRouterModel(openrouterId: string): Promise<LookupResult> {
  await requireOwner();
  const id = openrouterId.trim();
  if (!validOpenRouterId(id)) return { ok: true, found: false };
  const model = await findOpenRouterModel(id);
  if (model === "down") return { ok: false };
  if (!model) return { ok: true, found: false };
  const companies = await loadCompanies();
  if (!companies) return { ok: false };
  return { ok: true, found: true, draft: draftFromOpenRouter(model, companies) };
}

async function findOpenRouterModel(id: string): Promise<CatalogModel | null | "down"> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { cache: "no-store" });
    if (!response.ok) return "down";
    const body = (await response.json()) as { data?: unknown };
    const rows = Array.isArray(body.data) ? body.data : [];
    const model = rows.find((row) => row && typeof row === "object" && (row as CatalogModel).id === id);
    return (model as CatalogModel | undefined) ?? null;
  } catch {
    return "down";
  }
}

async function loadCompanies(): Promise<CompanyChoice[] | null> {
  const client = serviceOrThrow();
  const { data, error } = await client.from("companies").select("id, name, region").order("name");
  if (error) return null;
  return (data ?? []).flatMap((row) => {
    const region = row.region as string;
    if (region !== "us" && region !== "cn" && region !== "eu") return [];
    return [{ id: row.id as string, name: row.name as string, region: region as Region }];
  });
}
