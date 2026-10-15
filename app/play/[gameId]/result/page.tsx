import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { MessageBubble } from "@/components/message-bubble";
import { ShareActions } from "@/components/share-actions";
import { difficultyText, playedRoundFacts } from "@/lib/round-facts";
import { listGameModes, readPublicGame } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { readShareCard } from "@/lib/share-card-load";
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
  const onBoard = Boolean(mode?.leaderboard);
  const again =
    game.gameMode === "company" || game.gameMode === "region"
      ? `/play/new?gameMode=${game.gameMode}`
      : "/play";

  const state = game.status === "solved" ? "solved" : game.status === "miss" ? "miss" : "given-up";
  const status =
    game.status === "solved"
      ? `Solved on message ${game.messageNumber}.`
      : game.status === "miss"
        ? "Miss."
        : "Given up. This round is not on the leaderboard.";

  return (
    <div className="stack">
      <div className="model-lockup">
        <CompanyLogo src={game.model.logoPath} />
        <div>
          <h1>{game.model.name}</h1>
          <div className="model-facts">
            {[game.model.companyName, game.model.region, game.model.year, game.model.size].map((fact, index) => (
              <span key={index} className="pill">
                {fact}
              </span>
            ))}
          </div>
        </div>
      </div>
      <section className="card score-card">
        <p className="status" data-state={state}>
          {status}
        </p>
        <dl className="summary-list score-facts">
          <dt>Game mode</dt>
          <dd>{facts.mode}</dd>
          <dt>Difficulty</dt>
          <dd>{difficultyText(facts.difficulty)}</dd>
          {game.noHint ? (
            <>
              <dt>Hints</dt>
              <dd>No hints</dd>
            </>
          ) : null}
        </dl>
        {game.score !== undefined && game.breakdown ? (
          <>
            <p className="score-label">Your score</p>
            <p className="score">{game.score.toLocaleString("en-US")}</p>
            <table className="breakdown">
              <tbody>
                {game.breakdown.map((line) => (
                  <tr key={line.label}>
                    <td>{line.label}</td>
                    <td>{line.multiplier ?? (line.points ?? 0).toLocaleString("en-US")}</td>
                  </tr>
                ))}
                <tr>
                  <th>Total</th>
                  <th>{game.score.toLocaleString("en-US")}</th>
                </tr>
              </tbody>
            </table>
          </>
        ) : null}
        <p className="score-link">
          <a href="/scoring">How scoring works</a>
        </p>
      </section>
      {card ? (
        <div className="share-block">
          <ShareActions gameId={card.id} text={shareText(card)} />
        </div>
      ) : null}
      <div className="chat-head">
        <h2>The chat</h2>
      </div>
      <div className="transcript">
        {game.transcript.map((message) => (
          <MessageBubble key={`${message.turn}-${message.role}`} role={message.role} content={message.content} />
        ))}
      </div>
      <div className="row">
        <a className="button" href={again}>
          Play again
        </a>
        {onBoard && (game.status === "solved" || game.status === "miss") ? (
          <a className="button-quiet" href={`/leaderboard?gameMode=${game.gameMode}${game.difficulty ? `&difficulty=${game.difficulty}` : ""}&period=week`}>
            Leaderboard
          </a>
        ) : null}
      </div>
    </div>
  );
}
