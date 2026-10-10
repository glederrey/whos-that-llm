"use server";

import { redirect } from "next/navigation";
import { deleteSignedInAccount } from "@/lib/account-delete";

export async function deleteAccount(formData: FormData) {
  const confirmed = formData.get("confirm") === "yes";
  const result = await deleteSignedInAccount(confirmed);
  const back = formData.get("return") === "profile" ? "/profile" : "/account/delete";
  if (result === "auth") redirect(back === "/profile" ? "/login?next=/profile" : "/login?next=/account/delete");
  if (result) redirect(`${back}?notice=${result}`);
  redirect("/");
}
