"use server";

import { redirect } from "next/navigation";
import { deleteSignedInAccount } from "@/lib/account-delete";

export async function deleteAccount(formData: FormData) {
  const confirmed = formData.get("confirm") === "yes";
  const result = await deleteSignedInAccount(confirmed);
  if (result === "auth") redirect("/login?next=/account/delete");
  if (result) redirect(`/account/delete?notice=${result}`);
  redirect("/");
}
