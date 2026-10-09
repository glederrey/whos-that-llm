import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { safeNext } from "@/lib/paths";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const { user, username } = await currentProfile();
  if (user && username) redirect(next);
  if (user && !username) redirect(`/welcome?next=${encodeURIComponent(next)}`);

  return <LoginForm next={next} cancelled={params.error === "cancelled"} />;
}
