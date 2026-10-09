"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm({ next, cancelled }: { next: string; cancelled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(cancelled ? "Google sign-in was cancelled." : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function mapError(message: string) {
    const text = message.toLowerCase();
    if (text.includes("already")) return "That email is already registered.";
    if (text.includes("confirm")) return "Confirm your email, then come back.";
    if (text.includes("invalid") || text.includes("credential")) return "Wrong email or password.";
    return "Wrong email or password.";
  }

  async function google() {
    setBusy(true);
    setError("");
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (authError) {
      setError("Google sign-in was cancelled.");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    const supabase = createBrowserSupabase();
    if (tab === "create") {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setBusy(false);
      if (authError) {
        setError(mapError(authError.message));
        return;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("That email is already registered.");
        return;
      }
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }
      setNote("Check your email.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError(mapError(authError.message));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function forgot() {
    setError("");
    setNote("");
    if (!email.trim()) {
      setError("Wrong email or password.");
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    setBusy(false);
    setNote("Check your email.");
  }

  const signingIn = tab === "sign-in";

  return (
    <div className="auth">
      <h1>{signingIn ? "Sign in" : "Create account"}</h1>
      <p className="muted auth-switch">
        {signingIn ? "New here?" : "Already have an account?"}{" "}
        <button type="button" className="text-link" onClick={() => setTab(signingIn ? "create" : "sign-in")}>
          {signingIn ? "Create an account" : "Sign in"}
        </button>
      </p>
      <button type="button" className="button" onClick={google} disabled={busy}>
        Continue with Google
      </button>
      <p className="or">or</p>
      <form className="stack" onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={signingIn ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {signingIn ? (
          <button type="button" className="text-link forgot" onClick={forgot} disabled={busy}>
            Forgot password
          </button>
        ) : (
          <p className="muted">We email you a confirmation link.</p>
        )}
        <button type="submit" className="button" disabled={busy}>
          {signingIn ? "Sign in" : "Create account"}
        </button>
      </form>
      {note ? <p className="muted">{note}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
