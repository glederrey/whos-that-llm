import "server-only";

import { notFound } from "next/navigation";
import { emailsMatch } from "./admin-model";
import { adminEmail } from "./admin-owner";
import { currentUser } from "./session";

export async function sessionIsOwner() {
  const user = await currentUser();
  return emailsMatch(user?.email, adminEmail());
}

export async function requireOwner() {
  if (!(await sessionIsOwner())) notFound();
}
