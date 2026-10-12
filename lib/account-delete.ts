import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { clearedGameLink, clearedUsageLink } from "./anonymize-account";
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
  if (!(await anonymizeOwnedRows(client, user.id))) return "save";
  if (!(await removeAvatars(client, user.id))) return "save";
  const { error } = await client.auth.admin.deleteUser(user.id, false);
  if (error) return "save";
  const session = await createSessionClient();
  if (session) await session.auth.signOut();
  return null;
}

async function anonymizeOwnedRows(client: SupabaseClient, userId: string): Promise<boolean> {
  const games = await client.from("games").update(clearedGameLink()).eq("user_id", userId);
  if (games.error) return false;
  const usage = await client.from("usage").update(clearedUsageLink()).eq("user_id", userId);
  if (usage.error) return false;
  return true;
}

async function removeAvatars(client: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const paths: string[] = [];
    for (let offset = 0; offset < 10_000; offset += 100) {
      const listed = await client.storage.from("avatars").list(userId, { limit: 100, offset });
      if (listed.error) return false;
      const names = (listed.data ?? []).map((file) => file.name).filter((name) => name.length > 0);
      for (const name of names) paths.push(`${userId}/${name}`);
      if (names.length < 100) break;
    }
    for (let start = 0; start < paths.length; start += 100) {
      const removed = await client.storage.from("avatars").remove(paths.slice(start, start + 100));
      if (removed.error) return false;
    }
    return true;
  } catch {
    return false;
  }
}
