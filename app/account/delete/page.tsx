import { redirect } from "next/navigation";
import { deleteAccount } from "./actions";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  confirm: "Confirm that you want to delete your sign-in.",
  save: "Could not delete this account.",
};

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/delete");
  const params = await searchParams;
  const notice = params.notice ? notices[params.notice] : null;
  return (
    <div className="stack narrow">
      <h1>Delete account</h1>
      <form action={deleteAccount} className="card stack">
        <p>This removes your sign-in. Games you already played stay under your username. This cannot be undone.</p>
        {notice ? (
          <p className="error" role="alert">
            {notice}
          </p>
        ) : null}
        <label className="check">
          <input type="checkbox" name="confirm" value="yes" />
          I want to delete my sign-in.
        </label>
        <div>
          <button className="button-danger" type="submit">
            Delete account
          </button>
        </div>
      </form>
    </div>
  );
}
