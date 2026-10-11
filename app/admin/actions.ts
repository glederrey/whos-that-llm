"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClass, createRosterModel, setRosterEnabled, updateClass, updateRosterModel } from "@/lib/admin-roster";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fields(formData: FormData) {
  return {
    openrouterId: text(formData, "openrouterId"),
    name: text(formData, "name"),
    company: text(formData, "company"),
    family: text(formData, "family"),
    region: text(formData, "region"),
    year: text(formData, "year"),
    size: text(formData, "size"),
    classIds: formData.getAll("classId").flatMap((value) => (typeof value === "string" ? [value] : [])),
  };
}

function classFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    companyId: text(formData, "companyId"),
  };
}

function finish(notice: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath("/admin/classes");
  redirect(notice ? `/admin/models?notice=${notice}` : "/admin/models");
}

function finishClass(notice: string | null) {
  revalidatePath("/admin/classes");
  revalidatePath("/admin/models");
  redirect(notice ? `/admin/classes?notice=${notice}` : "/admin/classes");
}

export async function addModel(formData: FormData) {
  finish(await createRosterModel(fields(formData)));
}

export async function saveModel(formData: FormData) {
  finish(await updateRosterModel({ id: text(formData, "id"), ...fields(formData) }));
}

export async function setModelEnabled(formData: FormData) {
  finish(await setRosterEnabled(text(formData, "id"), text(formData, "enabled") === "1"));
}

export async function addClass(formData: FormData) {
  finishClass(await createClass(classFields(formData)));
}

export async function saveClass(formData: FormData) {
  finishClass(await updateClass({ id: text(formData, "id"), ...classFields(formData) }));
}
