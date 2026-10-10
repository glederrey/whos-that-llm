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
  notice: string | null;
  returnTo: "profile" | "account";
}) {
  return (
    <form action={deleteAccount} className="card stack">
      {returnTo === "profile" ? <h2>Delete account</h2> : null}
      <p>This removes your profile, picture, and games, including your name on the leaderboard. This cannot be undone.</p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      {returnTo === "profile" ? <input type="hidden" name="return" value="profile" /> : null}
      <label className="check">
        <input type="checkbox" name="confirm" value="yes" />
        I want to delete my account.
      </label>
      <div>
        <button className="button-danger" type="submit">
          Delete account
        </button>
      </div>
    </form>
  );
}
