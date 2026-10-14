"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  createRosterModel,
  disableRosterModels,
  loadRoster,
  removeCategory,
  setRosterEnabled,
  updateCategory,
  updateRosterModel,
  writeRosterPrices,
} from "@/lib/admin-roster";
import { loadOpenRouterCatalog } from "@/lib/openrouter-catalog";
import { planPriceUpdates, planUnavailable, type AvailabilityResult, type PriceSyncResult } from "@/lib/roster-sync";
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
  return { ok: true, changes: plan.changes, notUpdated: plan.notUpdated };
}

export async function checkRosterAvailability(): Promise<AvailabilityResult> {
  const catalog = await loadOpenRouterCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };
  const { rows } = await loadRoster();
  const plan = planUnavailable(rows, catalog.models);
  if (!plan) return { ok: false, error: "OpenRouter returned models in a shape this page does not read." };
  if (plan.disableIds.length > 0) {
    const saved = await disableRosterModels(plan.disableIds);
    if (!saved) return { ok: false, error: "Could not turn those models off." };
    revalidatePath("/admin");
    revalidatePath("/admin/models");
  }
  return { ok: true, unavailable: plan.unavailable };
}
