"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ResetPassword({ hasUsername }: { hasUsername: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError("Wrong email or password.");
      return;
    }
    router.push(hasUsername ? "/play" : "/welcome");
    router.refresh();
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h2>Choose a new password</h2>
      <label>
        New password
        <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      <button type="submit" className="button" disabled={busy}>
        Save password
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
