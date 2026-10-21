import { cleanUsername } from "./profile";
import { saveUsername } from "./rounds-queries";
import { fail, type ApiFailure } from "./rounds-shape";
import { currentUser } from "./session";
import { createSessionClient } from "./supabase/server";

export async function setUsername(userId: string, raw: string): Promise<ApiFailure | null> {
  if (!cleanUsername(raw)) return fail(422, "username");
  const session = await createSessionClient();
  if (!session) return fail(401, "unauthorized");
  const user = await currentUser();
  if (!user || user.id !== userId) return fail(401, "unauthorized");
  return saveUsername(session, raw);
}
