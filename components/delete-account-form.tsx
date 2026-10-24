"use client";

import { useRef, useState } from "react";
import { deleteAccount } from "@/app/account/delete/actions";
import { deleteConfirmed, deleteWord } from "@/lib/delete-confirm";

export function deleteNotice(code: string | undefined): string | null {
  if (code === "confirm") return "Confirm that you want to delete your account.";
  if (code === "save") return "Could not delete this account.";
  return null;
}

export function DeleteAccountForm({ notice, returnTo }: { notice?: string; returnTo: "profile" | "account" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const serverNotice = deleteNotice(notice);

  function open() {
    setTyped("");
    dialogRef.current?.showModal();
  }

  return (
    <div className="card stack">
      {returnTo === "profile" ? <h2>Delete account</h2> : null}
      <p>This removes your profile and picture, and your name on the leaderboard. This cannot be undone.</p>
      {serverNotice ? (
        <p className="error" role="alert">
          {serverNotice}
        </p>
      ) : null}
      <div className="delete-action">
        <button type="button" className="button-off" onClick={open}>
          Delete account
        </button>
      </div>
      <dialog
        ref={dialogRef}
        className="dialog"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <form action={deleteAccount}>
          <h2>Delete account</h2>
          <p>This removes your profile and picture, and your name on the leaderboard. This cannot be undone.</p>
          <input type="hidden" name="confirm" value="yes" />
          {returnTo === "profile" ? <input type="hidden" name="return" value="profile" /> : null}
          <label>
            Type {deleteWord} to confirm
            <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </label>
          <div className="row">
            <button type="button" className="button-quiet" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="button-off" disabled={!deleteConfirmed(typed)}>
              Delete account
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
