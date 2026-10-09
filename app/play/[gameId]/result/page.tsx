import { notFound, redirect } from "next/navigation";
import { listCategories, readPublicGame } from "@/lib/rounds";
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
  const categories = await listCategories();
  const onBoard = Boolean(categories.find((category) => category.id === game.category)?.leaderboard);
  const again =
    game.category === "company" || game.category === "family" || game.category === "region"
      ? `/play/new?category=${game.category}`
      : "/play";

  const status =
    game.status === "solved"
      ? `Solved on message ${game.messageNumber}.`
      : game.status === "miss"
        ? "Miss."
        : "Given up. This round is not on the leaderboard.";

  return (
    <div className="stack">
      <div className="model-lockup">
        <img src={game.model.logoPath} alt="" />
        <div>
          <h1>{game.model.name}</h1>
          <p className="muted">
            {game.model.companyName} · {game.model.region} · {game.model.family} · {game.model.year} · {game.model.size}
          </p>
        </div>
      </div>
      <p>{status}</p>
      {game.score !== undefined && game.breakdown && game.explanation ? (
        <div className="round">
          <section>
            <p className="score">{game.score.toLocaleString("en-US")}</p>
            <table className="breakdown">
              <tbody>
                {game.breakdown.map((line) => (
                  <tr key={line.label}>
                    <td>{line.label}</td>
                    <td>{line.points.toLocaleString("en-US")}</td>
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
          </section>
        </div>
      ) : null}
      <div className="transcript">
        {game.transcript.map((message) => (
          <div key={`${message.turn}-${message.role}`} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>
      <div className="row">
        <a className="button" href={again}>
          Play again
        </a>
        {onBoard && (game.status === "solved" || game.status === "miss") ? (
          <a className="button-quiet" href={`/leaderboard?category=${game.category}&period=week`}>
            Leaderboard
          </a>
        ) : null}
      </div>
    </div>
  );
}
