import { redirect } from "next/navigation";
import { HomeBoard } from "@/components/home-board";
import { config } from "@/lib/config";
import { listGameModes, lobbyState } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

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
