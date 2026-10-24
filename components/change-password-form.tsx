"use client";

import { useState } from "react";
import { changePassword } from "@/app/auth/actions";
import { changePasswordNotice } from "@/lib/auth-notices";
import { PasswordField } from "@/components/password-field";

export function ChangePasswordForm({ onCancel, onChanged }: { onCancel: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await changePassword(current, next);
    setBusy(false);
    if (result) {
      setError(changePasswordNotice(result));
      return;
    }
    onChanged();
  }

  return (
    <form id="change-password-card" className="card stack" onSubmit={submit}>
      <h2>Change password</h2>
      <PasswordField
        id="current-password"
        label="Current password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        showRules={false}
      />
      <PasswordField
        id="change-password"
        label="New password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        showRules
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="button" disabled={busy}>
          Change password
        </button>
        <button type="button" className="button-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
