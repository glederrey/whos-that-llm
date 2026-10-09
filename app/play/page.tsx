import { redirect } from "next/navigation";
import { Lobby } from "@/components/lobby";
import { lobbyState, listCategories } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const { user, username } = await currentProfile();
  if (!user) redirect("/login?next=/play");
  if (!username) redirect("/welcome?next=/play");
  const [state, categories] = await Promise.all([lobbyState(user.id), listCategories()]);
  const cards = categories
    .filter((category) => category.enabled)
    .map((category) => ({ id: category.id, name: category.name, blurb: category.blurb }));

  return (
    <Lobby
      paused={state.paused}
      played={state.played}
      cap={state.cap}
      activeGameId={state.activeGameId}
      poolSize={state.poolSize}
      nextAt={state.nextAt}
      cards={cards}
    />
  );
}
