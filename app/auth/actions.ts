"use server";

import { headers } from "next/headers";
import { allowedAuthUrl, authRedirectOrigin } from "@/lib/auth-cookies";
import { publicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

export type AuthNotice = "invalid" | "exists" | "confirm" | "auth";

async function redirectOrigin(): Promise<string> {
  const headerList = await headers();
  return authRedirectOrigin(headerList.get("x-forwarded-proto"), headerList.get("x-forwarded-host") ?? headerList.get("host"));
}

export async function startGoogleSignIn(): Promise<{ url: string } | { error: "auth" }> {
  const supabase = await createSessionClient();
  const env = publicEnv();
  if (!supabase || !env) return { error: "auth" };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await redirectOrigin()}/`, skipBrowserRedirect: true },
  });
  if (error || !data.url || !allowedAuthUrl(data.url, env.url)) return { error: "auth" };
  return { url: data.url };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthNotice | null> {
  const supabase = await createSessionClient();
  if (!supabase) return "auth";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await redirectOrigin()}/` },
  });
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("already")) return "exists";
    if (text.includes("confirm")) return "confirm";
    return "invalid";
  }
  if (data.user && data.user.identities && data.user.identities.length === 0) return "exists";
  if (!data.session) return "confirm";
  return null;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthNotice | null> {
  const supabase = await createSessionClient();
  if (!supabase) return "auth";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  if (error.message.toLowerCase().includes("confirm")) return "confirm";
  return "invalid";
}

export async function sendPasswordReset(email: string): Promise<void> {
  const supabase = await createSessionClient();
  if (!supabase || !email.trim()) return;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await redirectOrigin()}/?reset=1` });
}

export async function updatePassword(password: string): Promise<AuthNotice | null> {
  const supabase = await createSessionClient();
  if (!supabase) return "auth";
  const { error } = await supabase.auth.updateUser({ password });
  return error ? "invalid" : null;
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  if (supabase) await supabase.auth.signOut();
}
