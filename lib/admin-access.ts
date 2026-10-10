import "server-only";

import { notFound } from "next/navigation";
import { emailsMatch } from "./admin-model";
import { ownerAddress } from "./admin-owner";
import { currentUser } from "./session";

export async function requireOwner() {
  const user = await currentUser();
  if (!emailsMatch(user?.email, ownerAddress)) notFound();
}
