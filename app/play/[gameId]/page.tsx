import { notFound, redirect } from "next/navigation";
import { RoundBoard } from "@/components/round-board";
import { readPublicGame } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { displayFont, monoFont, uiFont } from "./fonts";
import "./round.css";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const { user, username } = await currentProfile();
  const next = `/play/${gameId}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!username) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  const game = await readPublicGame(gameId, user.id);
  if (!game) notFound();
  if (game.status !== "active") redirect(`/play/${gameId}/result`);
  return (
    <div className={`round-skin ${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}>
      <RoundBoard initial={game} />
    </div>
  );
}
