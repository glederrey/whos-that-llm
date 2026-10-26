import { notFound } from "next/navigation";
import { MessageBubble } from "@/components/message-bubble";
import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { parseGameSearch } from "@/lib/admin-game";
import { loadGame } from "@/lib/admin-game-data";
import { usd } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const search = parseGameSearch((await params).id);
  if (search.kind !== "id") notFound();
  const detail = await loadGame(search.id);
  if (!detail) notFound();
  const { game, usage } = detail;
  const hints = Array.isArray(game.hints) ? (game.hints as string[]) : [];
  const breakdown = game.score_breakdown ? JSON.stringify(game.score_breakdown, null, 2) : null;
  const explanation = Array.isArray(game.score_explanation) ? (game.score_explanation as string[]) : [];
  const facts: [string, string][] = [
    ["Game id", String(game.id)],
    ["Player", String(game.username ?? "Deleted account")],
    ["Mode", `${game.game_mode}${game.pool_key ? ` (${game.pool_key})` : ""}`],
    ["Hidden model", detail.modelName],
    ["Status", String(game.status)],
    ["Started", String(game.started_at)],
    ["Finished", game.finished_at ? String(game.finished_at) : "still open"],
    ["Messages", String(game.message_count)],
    ["Score", game.score === null || game.score === undefined ? "–" : String(game.score)],
    ["Hints bought", hints.length > 0 ? hints.join(", ") : "none"],
    ["No hints", game.no_hint ? "yes" : "no"],
    ["Ledger", `${usage.calls} calls, ${usage.failed} failed, ${usage.inputTokens + usage.outputTokens + usage.reasoningTokens} tokens, ${usd(usage.costUsd)}`],
  ];

  return (
    <div className="stack">
      <SectionNav />
      <p>
        <a href="/admin/games">Back to games</a>
      </p>
      <h1>Game</h1>
      <div className="card roster-card">
        <table className="roster compact">
          <tbody>
            {facts.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Conversation</h2>
      {detail.transcript.length === 0 ? (
        <p className="muted">No message was stored for this round.</p>
      ) : (
        <div className="transcript">
          {detail.transcript.map((message) => (
            <MessageBubble key={`${message.turn}-${message.role}`} role={message.role === "user" ? "user" : "assistant"} content={message.content} />
          ))}
        </div>
      )}

      <h2>Guesses</h2>
      {detail.guesses.length === 0 ? (
        <p className="muted">No guess.</p>
      ) : (
        <div className="card roster-card">
          <table className="roster compact">
            <thead>
              <tr>
                <th>Turn</th>
                <th>Guessed model</th>
                <th>Region</th>
                <th>Right</th>
              </tr>
            </thead>
            <tbody>
              {detail.guesses.map((guess) => (
                <tr key={guess.turn}>
                  <td>{guess.turn}</td>
                  <td>{guess.guessedModel ?? "–"}</td>
                  <td>{guess.guessedRegion ?? "–"}</td>
                  <td>{guess.modelCorrect ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {breakdown || explanation.length > 0 ? (
        <>
          <h2>Score</h2>
          {explanation.map((line) => (
            <p key={line} className="muted">
              {line}
            </p>
          ))}
          {breakdown ? <pre className="card">{breakdown}</pre> : null}
        </>
      ) : null}
    </div>
  );
}
