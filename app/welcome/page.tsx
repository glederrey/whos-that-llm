import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeForm } from "@/components/welcome-form";
import { safeNext } from "@/lib/paths";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Choose the username that appears on the leaderboard. A picture is optional, and you pick both before the first round.",
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const { user, username } = await currentProfile();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/welcome?next=${encodeURIComponent(next)}`)}`);
  if (username) redirect(next);
  return <WelcomeForm next={next} />;
}
