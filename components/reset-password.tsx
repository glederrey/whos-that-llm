"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/app/auth/actions";
import { PasswordField } from "@/components/password-field";

export function ResetPassword({ tokenHash }: { tokenHash: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await resetPassword(tokenHash, password);
    if (result) {
      setBusy(false);
      setError(typeof result === "object" ? result.rules : result === "expired" ? "This link has expired or was already used. Request a new one from the sign-in page." : "Could not save that password. Request a new link from the sign-in page.");
      return;
    }
    router.push("/login?notice=password-changed");
    router.refresh();
  }

  return (
    <div className="auth auth-screen">
      <h1>Choose a new password</h1>
      <form className="stack" onSubmit={submit}>
        <PasswordField id="new-password" value={password} onChange={setPassword} autoComplete="new-password" showRules />
        <button type="submit" className="button" disabled={busy}>
          Save password
        </button>
      </form>
      {error ? <p className="error auth-error">{error}</p> : null}
    </div>
  );
}
