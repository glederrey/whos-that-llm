import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeBoard } from "@/components/home-board";
import { config } from "@/lib/config";
import { listGameModes, lobbyState } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Start a round. Daily, All models, and Company are open. You have ten messages with a hidden model, then you name it.",
};

export default async function PlayPage() {
  const { user, username } = await currentProfile();
  if (!user) redirect("/login?next=/play");
  if (!username) redirect("/welcome?next=/play");
  const [gameModes, state] = await Promise.all([listGameModes(), lobbyState(user.id)]);

  return (
    <HomeBoard
      paused={state.paused}
      played={state.played}
      cap={state.cap ?? config.hourlyCap}
      openGames={state.openGames}
      dailyFinished={state.dailyFinished}
      poolSize={state.poolSize}
      difficultyCounts={state.difficultyCounts}
      companies={state.companies}
      categories={state.categories}
      nextAt={state.nextAt}
      gameModes={gameModes.map((gameMode) => ({
        id: gameMode.id,
        name: gameMode.name,
        blurb: gameMode.blurb,
        enabled: gameMode.enabled,
      }))}
    />
  );
}
