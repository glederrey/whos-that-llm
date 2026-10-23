"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSize } from "@/lib/admin-model";
import { requireOwner } from "@/lib/admin-access";
import { parseDifficulty } from "@/lib/difficulty";
import {
  createCategory,
  createRosterModel,
  insertDiscoveredModels,
  loadRoster,
  setCategoryEnabled,
  setRosterEnabled,
  updateCategory,
  updateRosterModel,
} from "@/lib/admin-roster";
import { createOrigin, setOriginEnabled, updateOrigin } from "@/lib/admin-origins";
import { checkAvailability } from "@/lib/availability-check";
import { loadOpenRouterCatalog } from "@/lib/openrouter-catalog";
import { clearProviderBlacklist } from "@/lib/openrouter-providers";
import {
  planNewModels,
  type AddModelsResult,
  type AvailabilityResult,
  type NewModelsResult,
} from "@/lib/roster-sync";
import { modelsReturnPath } from "@/lib/roster-list";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fields(formData: FormData) {
  return {
    openrouterId: text(formData, "openrouterId"),
    name: text(formData, "name"),
    company: text(formData, "company"),
    origin: text(formData, "origin"),
    year: text(formData, "year"),
    releasedOn: text(formData, "releasedOn"),
    size: text(formData, "size"),
    difficulty: text(formData, "difficulty"),
    categoryIds: formData.getAll("categoryId").flatMap((value) => (typeof value === "string" ? [value] : [])),
  };
}

function categoryFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    companyId: text(formData, "companyId"),
    emoji: text(formData, "emoji"),
    image: formData.get("image") instanceof File ? (formData.get("image") as File) : null,
    removeIcon: formData.get("removeIcon") === "1",
    modelIds: formData.getAll("modelId").flatMap((value) => (typeof value === "string" ? [value] : [])),
  };
}

function finish(formData: FormData, notice: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath("/admin/categories");
  redirect(
    modelsReturnPath({
      notice: notice ?? "",
      q: text(formData, "q"),
      sort: text(formData, "sort"),
      dir: text(formData, "dir"),
      active: text(formData, "active"),
      inactive: text(formData, "inactive"),
      unavailable: text(formData, "unavailable"),
    }),
  );
}

function finishCategory(notice: string | null) {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/models");
  revalidatePath("/play");
  revalidatePath("/leaderboard");
  revalidatePath("/statistics");
  redirect(notice ? `/admin/categories?notice=${notice}` : "/admin/categories");
}

function finishOrigin(notice: string | null) {
  revalidatePath("/admin/origins");
  revalidatePath("/admin/models");
  revalidatePath("/admin/companies");
  revalidatePath("/play");
  redirect(notice ? `/admin/origins?notice=${notice}` : "/admin/origins");
}

function originFields(formData: FormData) {
  return { name: text(formData, "name"), flag: text(formData, "flag"), sortOrder: text(formData, "sortOrder") };
}

export async function addOrigin(formData: FormData) {
  await requireOwner();
  finishOrigin(await createOrigin(originFields(formData)));
}

export async function saveOrigin(formData: FormData) {
  await requireOwner();
  finishOrigin(await updateOrigin({ id: text(formData, "id"), ...originFields(formData) }));
}

export async function toggleOrigin(formData: FormData) {
  await requireOwner();
  finishOrigin(await setOriginEnabled(text(formData, "id"), text(formData, "enabled") === "1"));
}

export async function addModel(formData: FormData) {
  await requireOwner();
  finish(formData, await createRosterModel(fields(formData)));
}

export async function saveModel(formData: FormData) {
  await requireOwner();
  finish(formData, await updateRosterModel({ id: text(formData, "id"), ...fields(formData) }));
}

export async function setModelEnabled(formData: FormData) {
  await requireOwner();
  finish(formData, await setRosterEnabled(text(formData, "id"), text(formData, "enabled") === "1"));
}

export async function addCategory(formData: FormData) {
  await requireOwner();
  finishCategory(await createCategory(categoryFields(formData)));
}

export async function saveCategory(formData: FormData) {
  await requireOwner();
  finishCategory(await updateCategory({ id: text(formData, "id"), ...categoryFields(formData) }));
}

export async function toggleCategory(formData: FormData) {
  await requireOwner();
  finishCategory(await setCategoryEnabled(text(formData, "id"), text(formData, "enabled") === "1"));
}

export async function clearProvider(formData: FormData) {
  await requireOwner();
  const ok = await clearProviderBlacklist(text(formData, "slug"));
  revalidatePath("/admin/providers");
  redirect(ok ? "/admin/providers" : "/admin/providers?notice=save");
}

export async function checkRosterAvailability(): Promise<AvailabilityResult> {
  await requireOwner();
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const outcome = await checkAvailability(catalog.models, true, "owner");
  if (!outcome.ok) return { ok: false, error: outcome.error };
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/companies");
  return outcome;
}

export async function searchNewModels(): Promise<NewModelsResult> {
  await requireOwner();
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows } = await loadRoster();
  return { ok: true, models: planNewModels(rows, catalog.models, Math.floor(Date.now() / 1000)) };
}

export async function addNewRosterModels(picks: { id: string; size: string; difficulty: string }[]): Promise<AddModelsResult> {
  await requireOwner();
  if (!Array.isArray(picks) || picks.length > 200 || picks.some((pick) => !pick || typeof pick !== "object")) {
    return { ok: false, error: "Could not add those models." };
  }
  if (picks.length === 0) return { ok: true, added: 0 };
  if (picks.some((pick) => typeof pick.id !== "string" || typeof pick.size !== "string" || typeof pick.difficulty !== "string" || !parseSize(pick.size) || !parseDifficulty(pick.difficulty))) {
    return { ok: false, error: "Choose a size and a difficulty for each model." };
  }
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows, companies } = await loadRoster();
  const planned = planNewModels(rows, catalog.models, Math.floor(Date.now() / 1000));
  const byId = new Map(planned.map((model) => [model.id, model]));
  const chosen = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    const id = pick.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const model = byId.get(id);
    const size = parseSize(pick.size);
    const difficulty = parseDifficulty(pick.difficulty);
    if (model && size && difficulty) chosen.push({ ...model, size, difficulty });
  }
  if (chosen.length === 0) return { ok: true, added: 0 };
  const added = await insertDiscoveredModels(
    chosen.map((model) => ({
      id: model.id,
      name: model.name,
      releasedOn: model.releasedOn,
      size: model.size,
      difficulty: model.difficulty,
      reasoning: model.reasoning,
    })),
    companies,
  );
  if (added === null) return { ok: false, error: "Could not add those models." };
  if (added > 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/models");
  }
  return { ok: true, added };
}
