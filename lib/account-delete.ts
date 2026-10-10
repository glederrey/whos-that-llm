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
  if (!(await removeOwnedRows(client, user.id))) return "save";
  if (!(await removeAvatars(client, user.id))) return "save";
  const { error } = await client.auth.admin.deleteUser(user.id, false);
  if (error) return "save";
  const session = await createSessionClient();
  if (session) await session.auth.signOut();
  return null;
}

async function removeOwnedRows(client: SupabaseClient, userId: string): Promise<boolean> {
  const usage = await client.from("usage").delete().eq("user_id", userId);
  if (usage.error) return false;
  const games = await client.from("games").delete().eq("user_id", userId);
  if (games.error) return false;
  return true;
}

async function removeAvatars(client: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const listed = await client.storage.from("avatars").list(userId, { limit: 100 });
    if (listed.error) return false;
    const names = (listed.data ?? []).map((file) => file.name).filter((name) => name.length > 0 && !name.startsWith("."));
    if (names.length === 0) return true;
    const removed = await client.storage.from("avatars").remove(names.map((name) => `${userId}/${name}`));
    return !removed.error;
  } catch {
    return false;
  }
}
