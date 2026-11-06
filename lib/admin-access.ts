import "server-only";

import { notFound } from "next/navigation";
import { hasAdminFlag } from "./admin-model";
import { currentUser, strictUser } from "./session";

/**
 * The claims answer "not an admin" for free. Only a token that says admin is checked against
 * Supabase Auth, so a revoked admin with a still-valid JWT does not get in.
 */
export async function sessionIsOwner() {
  const user = await currentUser();
  if (!hasAdminFlag(user)) return false;
  return hasAdminFlag(await strictUser());
}

export async function requireOwner() {
  if (!(await sessionIsOwner())) notFound();
}
