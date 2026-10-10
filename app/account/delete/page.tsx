import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/delete");
  const params = await searchParams;
  return (
    <div className="stack narrow">
      <h1>Delete account</h1>
      <DeleteAccountForm notice={params.notice} returnTo="account" />
    </div>
  );
}
