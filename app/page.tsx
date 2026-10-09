import { redirect } from "next/navigation";
import { HomeBoard } from "@/components/home-board";
import { ResetPassword } from "@/components/reset-password";
import { config } from "@/lib/config";
import { listCategories, lobbyState } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  const resetting = params.reset === "1";
  if (user && !username && !resetting) redirect("/welcome");
  const signedIn = Boolean(user && username);
  const [categories, state] = await Promise.all([
    listCategories(),
    signedIn && user ? lobbyState(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="stack">
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <HomeBoard
        signedIn={signedIn}
        paused={state?.paused ?? false}
        played={state?.played ?? 0}
        cap={state?.cap ?? config.hourlyCap}
        activeGameId={state?.activeGameId ?? null}
        poolSize={state?.poolSize ?? 2}
        nextAt={state?.nextAt ?? null}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          blurb: category.blurb,
          enabled: category.enabled,
        }))}
      />
    </div>
  );
}
