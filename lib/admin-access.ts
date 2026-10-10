import "server-only";

import { notFound } from "next/navigation";
import { hasAdminFlag } from "./admin-model";
import { currentUser } from "./session";

export async function sessionIsOwner() {
  const user = await currentUser();
  return hasAdminFlag(user);
}

export async function requireOwner() {
  if (!(await sessionIsOwner())) notFound();
}
