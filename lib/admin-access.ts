import "server-only";

import { notFound } from "next/navigation";
import { emailsMatch } from "./admin-model";
import { ownerAddress } from "./admin-owner";
import { currentUser } from "./session";

export async function sessionIsOwner() {
  const user = await currentUser();
  return emailsMatch(user?.email, ownerAddress);
}

export async function requireOwner() {
  if (!(await sessionIsOwner())) notFound();
}
