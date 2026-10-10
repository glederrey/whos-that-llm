import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceOrThrow } from "./rounds";
import { currentUser } from "./session";
import { createSessionClient } from "./supabase/server";

export async function deleteSignedInAccount(confirmed: boolean): Promise<"confirm" | "auth" | "save" | null> {
  if (!confirmed) return "confirm";
  const user = await currentUser();
  if (!user) return "auth";
  let client: SupabaseClient;
  try {
    client = serviceOrThrow();
  } catch {
    return "save";
  }
  await removeAvatars(client, user.id);
  const { error } = await client.auth.admin.deleteUser(user.id, false);
  if (error) return "save";
  const session = await createSessionClient();
  if (session) await session.auth.signOut();
  return null;
}

async function removeAvatars(client: SupabaseClient, userId: string) {
  try {
    const listed = await client.storage.from("avatars").list(userId, { limit: 100 });
    const names = (listed.data ?? []).map((file) => file.name).filter((name) => name.length > 0 && !name.startsWith("."));
    if (names.length === 0) return;
    await client.storage.from("avatars").remove(names.map((name) => `${userId}/${name}`));
  } catch {
    return;
  }
}
