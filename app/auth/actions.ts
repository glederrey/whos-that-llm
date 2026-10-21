"use server";

import { headers } from "next/headers";
import { allowedAuthUrl, authRedirectOrigin } from "@/lib/auth-cookies";
import { signUpFailureNotice } from "@/lib/auth-notices";
import { passwordProblem, weakPasswordNotice } from "@/lib/password-rules";
import { publicEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

export type AuthNotice = "invalid" | "exists" | "confirm" | "auth";

export type SignUpNotice = AuthNotice | "rate" | { rules: string };

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

export async function signUpWithEmail(email: string, password: string): Promise<SignUpNotice | null> {
  const problem = passwordProblem(password);
  if (problem) return { rules: problem };
  const supabase = await createSessionClient();
  if (!supabase) return "auth";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await redirectOrigin()}/` },
  });
  if (error) {
    const weak = weakPasswordNotice(password, error);
    if (weak) return { rules: weak };
    return signUpFailureNotice(error);
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
  await supabase.auth.resetPasswordForEmail(email);
}

// The reset mail links to /reset-password?token_hash=...&type=recovery (the
// "Reset Password" template, docs/build.md). The token is only spent here, in
// the same call that sets the new password, so opening the link signs nobody in.
export async function resetPassword(tokenHash: string, password: string): Promise<AuthNotice | { rules: string } | "expired" | null> {
  const problem = passwordProblem(password);
  if (problem) return { rules: problem };
  const supabase = await createSessionClient();
  if (!supabase || !tokenHash) return "auth";
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (verifyError) return "expired";
  const { error } = await supabase.auth.updateUser({ password });
  await supabase.auth.signOut();
  // Supabase refuses a password equal to the current one. It is already the
  // password the player typed, so that counts as saved.
  if (error && error.code !== "same_password") {
    const weak = weakPasswordNotice(password, error);
    return weak ? { rules: weak } : "invalid";
  }
  return null;
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  if (supabase) await supabase.auth.signOut();
}
