"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSize } from "@/lib/admin-model";
import { parseDifficulty } from "@/lib/difficulty";
import {
  createCategory,
  createRosterModel,
  markRosterUnavailable,
  insertDiscoveredModels,
  loadRoster,
  removeCategory,
  setRosterEnabled,
  updateCategory,
  updateRosterModel,
  writeReasoningFlags,
  writeRosterPrices,
} from "@/lib/admin-roster";
import { loadOpenRouterCatalog } from "@/lib/openrouter-catalog";
import { clearProviderBlacklist } from "@/lib/openrouter-providers";
import {
  planNewModels,
  planPriceUpdates,
  planUnavailable,
  type AddModelsResult,
  type AvailabilityResult,
  type NewModelsResult,
  type PriceSyncResult,
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
    region: text(formData, "region"),
    year: text(formData, "year"),
    releasedOn: text(formData, "releasedOn"),
    size: text(formData, "size"),
    difficulty: text(formData, "difficulty"),
    inputPrice: text(formData, "inputPrice"),
    outputPrice: text(formData, "outputPrice"),
    categoryIds: formData.getAll("categoryId").flatMap((value) => (typeof value === "string" ? [value] : [])),
  };
}

function categoryFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    companyId: text(formData, "companyId"),
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
  redirect(notice ? `/admin/categories?notice=${notice}` : "/admin/categories");
}

export async function addModel(formData: FormData) {
  finish(formData, await createRosterModel(fields(formData)));
}

export async function saveModel(formData: FormData) {
  finish(formData, await updateRosterModel({ id: text(formData, "id"), ...fields(formData) }));
}

export async function setModelEnabled(formData: FormData) {
  finish(formData, await setRosterEnabled(text(formData, "id"), text(formData, "enabled") === "1"));
}

export async function addCategory(formData: FormData) {
  finishCategory(await createCategory(categoryFields(formData)));
}

export async function saveCategory(formData: FormData) {
  finishCategory(await updateCategory({ id: text(formData, "id"), ...categoryFields(formData) }));
}

export async function deleteCategory(formData: FormData) {
  const message = await removeCategory(text(formData, "id"));
  revalidatePath("/admin/categories");
  revalidatePath("/admin/models");
  redirect(message ? `/admin/categories?error=${encodeURIComponent(message)}` : "/admin/categories");
}

export async function clearProvider(formData: FormData) {
  const ok = await clearProviderBlacklist(text(formData, "slug"));
  revalidatePath("/admin/providers");
  redirect(ok ? "/admin/providers" : "/admin/providers?notice=save");
}

export async function updateRosterPrices(): Promise<PriceSyncResult> {
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows } = await loadRoster();
  const plan = planPriceUpdates(rows, catalog.models);
  if (plan.updates.length > 0) {
    const saved = await writeRosterPrices(plan.updates);
    if (!saved) return { ok: false, error: "Could not save the new prices." };
    revalidatePath("/admin");
    revalidatePath("/admin/models");
  }
  const reasoning = await writeReasoningFlags(catalog.models);
  if (!reasoning) return { ok: false, error: "Could not save which models can reason." };
  revalidatePath("/admin/models");
  return { ok: true, changes: plan.changes, notUpdated: plan.notUpdated };
}

export async function checkRosterAvailability(): Promise<AvailabilityResult> {
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows } = await loadRoster();
  const plan = planUnavailable(rows, catalog.models);
  if (!plan) return { ok: false, error: "OpenRouter returned models in a shape this page does not read." };
  if (plan.markIds.length > 0) {
    const saved = await markRosterUnavailable(plan.markIds);
    if (!saved) return { ok: false, error: "Could not mark those models unavailable." };
    revalidatePath("/admin");
    revalidatePath("/admin/models");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/companies");
  }
  const reasoning = await writeReasoningFlags(catalog.models);
  if (!reasoning) return { ok: false, error: "Could not save which models can reason." };
  revalidatePath("/admin/models");
  return { ok: true, unavailable: plan.unavailable };
}

export async function searchNewModels(): Promise<NewModelsResult> {
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows } = await loadRoster();
  return { ok: true, models: planNewModels(rows, catalog.models, Math.floor(Date.now() / 1000)) };
}

export async function addNewRosterModels(picks: { id: string; size: string; difficulty: string }[]): Promise<AddModelsResult> {
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
      inputUsdPerMtok: model.inputUsdPerMtok,
      outputUsdPerMtok: model.outputUsdPerMtok,
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
