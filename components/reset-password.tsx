"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";

export function ResetPassword({ hasUsername }: { hasUsername: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await updatePassword(password);
    setBusy(false);
    if (result) {
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
