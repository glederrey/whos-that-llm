import { redirect } from "next/navigation";
import { HomeBoard } from "@/components/home-board";
import { config } from "@/lib/config";
import { listCategories, lobbyState } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const { user, username } = await currentProfile();
  if (!user) redirect("/login?next=/play");
  if (!username) redirect("/welcome?next=/play");
  const [categories, state] = await Promise.all([listCategories(), lobbyState(user.id)]);

  return (
    <HomeBoard
      paused={state.paused}
      played={state.played}
      cap={state.cap ?? config.hourlyCap}
      activeGameId={state.activeGameId}
      poolSize={state.poolSize}
      difficultyCounts={state.difficultyCounts}
      nextAt={state.nextAt}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        blurb: category.blurb,
        enabled: category.enabled,
      }))}
    />
  );
}
