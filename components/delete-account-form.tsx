"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import { deleteAccount } from "@/app/account/delete/actions";

export function deleteNotice(code: string | undefined): string | null {
  if (code === "confirm") return "Confirm that you want to delete your account.";
  if (code === "save") return "Could not delete this account.";
  return null;
}

export function DeleteAccountForm({
  notice,
  returnTo,
}: {
  notice?: string;
  returnTo: "profile" | "account";
}) {
  const [blocked, setBlocked] = useState(false);
  const serverNotice = deleteNotice(notice);

  function blockUnchecked(form: HTMLFormElement) {
    if (returnTo !== "profile") return false;
    if (new FormData(form).get("confirm") === "yes") return false;
    setBlocked(true);
    return true;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!blockUnchecked(event.currentTarget)) return;
    event.preventDefault();
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form || !blockUnchecked(form)) return;
    event.preventDefault();
  }

  const shown = blocked ? "Confirm that you want to delete your account." : serverNotice;

  return (
    <form action={deleteAccount} className="card stack" onSubmit={onSubmit}>
      {returnTo === "profile" ? <h2>Delete account</h2> : null}
      <p>This removes your profile and picture, and your name on the leaderboard. This cannot be undone.</p>
      {shown ? (
        <p className="error" role="alert">
          {shown}
        </p>
      ) : null}
      {returnTo === "profile" ? <input type="hidden" name="return" value="profile" /> : null}
      <label className="check">
        <input
          type="checkbox"
          name="confirm"
          value="yes"
          onChange={(event) => {
            if (event.target.checked) setBlocked(false);
          }}
        />
        I want to delete my account.
      </label>
      <div>
        <button className="button-off" type="submit" onClick={onClick}>
          Delete account
        </button>
      </div>
    </form>
  );
}
