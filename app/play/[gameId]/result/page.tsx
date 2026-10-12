import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { MarkdownMessage } from "@/components/markdown-message";
import { ResultSummary } from "@/components/round-facts";
import { difficultyText, playedRoundFacts } from "@/lib/round-facts";
import { listGameModes, readPublicGame } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const { user, username } = await currentProfile();
  const next = `/play/${gameId}/result`;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!username) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  const game = await readPublicGame(gameId, user.id);
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
      <p className="status" data-state={state}>
        {status}
      </p>
      <ResultSummary mode={facts.mode} difficulty={difficultyText(facts.difficulty)} noHint={game.noHint} />
      {game.score !== undefined && game.breakdown && game.explanation ? (
        <div className="result-grid">
          <section className="card score-card">
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
          </section>
          <section className="card explain">
            <h2>How this score works</h2>
            {game.explanation.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              <a href="/scoring">How scoring works</a>
            </p>
          </section>
        </div>
      ) : (
        <p>
          <a href="/scoring">How scoring works</a>
        </p>
      )}
      <div className="chat-head">
        <h2>The chat</h2>
      </div>
      <div className="transcript">
        {game.transcript.map((message) => (
          <div key={`${message.turn}-${message.role}`} className={`bubble ${message.role}`}>
            {message.role === "assistant" ? <MarkdownMessage text={message.content} /> : message.content}
          </div>
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
