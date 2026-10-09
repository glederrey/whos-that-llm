import { createSessionClient } from "./supabase/server";

export async function currentUser() {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function currentProfile() {
  const user = await currentUser();
  if (!user) return { user: null, username: null as string | null };
  const supabase = await createSessionClient();
  const { data } = await supabase!
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  return { user, username: (data?.username as string | null) ?? null };
}
