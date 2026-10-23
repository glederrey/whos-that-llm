import { notFound, redirect } from "next/navigation";
import { MessageBubble } from "@/components/message-bubble";
import { ScoreCard } from "@/components/score-card";
import { modeHasDifficulty, playedRoundFacts, roundPlace } from "@/lib/round-facts";
import { listGameModes, readPublicGame, serviceOrThrow } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { readCategoryName, readShareCard } from "@/lib/share-card-load";
import { shareText } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const { user, username } = await currentProfile();
  const next = `/play/${gameId}/result`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!username) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  const [game, card] = await Promise.all([readPublicGame(gameId, user.id), readShareCard(gameId)]);
  if (!game || !game.model) notFound();
  if (game.status === "active") redirect(`/play/${gameId}`);
  const gameModes = await listGameModes();
  const mode = gameModes.find((gameMode) => gameMode.id === game.gameMode);
  const facts = playedRoundFacts({
    gameModeId: game.gameMode,
    gameModeName: mode?.name,
    difficulty: game.difficulty,
  });
  const categoryName =
    game.gameMode === "class" && game.poolKey ? await readCategoryName(serviceOrThrow(), game.poolKey) : null;
  const onBoard = Boolean(mode?.leaderboard);
  const again = "/play";
  const leaderboardHref =
    game.gameMode === "company"
      ? `/leaderboard?gameMode=company${game.poolKey ? `&company=${encodeURIComponent(game.poolKey)}` : ""}&period=week`
      : game.gameMode === "class"
        ? `/leaderboard?gameMode=class${game.poolKey ? `&category=${encodeURIComponent(game.poolKey)}` : ""}&period=week`
        : `/leaderboard?gameMode=${game.gameMode}${game.difficulty ? `&difficulty=${game.difficulty}` : ""}&period=week`;

  const nextRound = (
    <div className="row result-actions">
      <a className="button" href={again}>
        Play again
      </a>
      {onBoard && (game.status === "solved" || game.status === "miss") ? (
        <a className="button-quiet" href={leaderboardHref}>
          Leaderboard
        </a>
      ) : null}
    </div>
  );

  return (
    <div className="stack result">
      <ScoreCard
        model={{
          name: game.model.name,
          logoPath: game.model.logoPath,
          facts: [game.model.companyName, game.model.origin, String(game.model.year), game.model.size],
        }}
        score={game.score ?? null}
        messages={game.messageNumber}
        state={game.status === "solved" ? "solved" : game.status === "miss" ? "miss" : "given_up"}
        mode={facts.mode}
        difficulty={facts.difficulty}
        hasDifficulty={modeHasDifficulty(game.gameMode)}
        place={roundPlace(game.gameMode, game.model.companyName, categoryName)}
        poolSize={card?.poolSize ?? null}
        noHint={game.noHint}
        breakdown={game.breakdown ?? null}
        origin={game.origin ?? null}
        share={card ? { gameId: card.id, text: shareText(card) } : null}
        actions={nextRound}
      />
      <div className="chat-head">
        <h2>The chat</h2>
      </div>
      <div className="transcript">
        {game.transcript.map((message) => (
          <MessageBubble key={`${message.turn}-${message.role}`} role={message.role} content={message.content} />
        ))}
      </div>
    </div>
  );
}
