import { notFound } from "next/navigation";
import { Figures } from "@/components/admin-panels";
import { MessageBubble } from "@/components/message-bubble";
import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { parseGameSearch, scoreLines, utcStamp } from "@/lib/admin-game";
import { loadGame } from "@/lib/admin-game-data";
import { usd } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = { active: "Open", solved: "Solved", miss: "Failed", given_up: "Given up" };

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const search = parseGameSearch((await params).id);
  if (search.kind !== "id") notFound();
  const detail = await loadGame(search.id);
  if (!detail) notFound();
  const { game, usage } = detail;
  const status = String(game.status);
  const hints = Array.isArray(game.hints) ? (game.hints as string[]) : [];
  const lines = scoreLines(game.score_breakdown);
  const explanation = Array.isArray(game.score_explanation) ? (game.score_explanation as string[]) : [];
  const tokens = usage.inputTokens + usage.outputTokens + usage.reasoningTokens;
  const details: [string, string][] = [
    ["Mode", `${game.game_mode}${game.pool_key ? ` (${game.pool_key})` : ""}`],
    ["Started", utcStamp(String(game.started_at))],
    ["Finished", game.finished_at ? utcStamp(String(game.finished_at)) : "Still open"],
    ["Hints bought", hints.length > 0 ? hints.join(", ") : "None"],
    ["No hints", game.no_hint ? "Yes" : "No"],
    ["Ledger", `${usage.calls} calls, ${usage.failed} failed, ${tokens.toLocaleString("en-US")} tokens, ${usd(usage.costUsd)}`],
  ];

  return (
    <div className="stack">
      <SectionNav />
      <p>
        <a href="/admin/games">← Back to games</a>
      </p>
      <header className="game-head">
        <h1>{detail.modelName}</h1>
        <span className={`pill status-${status}`}>{statusLabel[status] ?? status}</span>
      </header>
      <p className="muted game-sub">
        Played by {String(game.username ?? "a deleted account")} · <code>{String(game.id)}</code>
      </p>

      <Figures
        items={[
          { label: "Score", value: game.score === null || game.score === undefined ? "–" : Number(game.score).toLocaleString("en-US") },
          { label: "Messages", value: String(game.message_count) },
          { label: "Guesses", value: String(detail.guesses.length) },
        ]}
      />

      <div className="card">
        <dl className="game-facts">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2>Conversation</h2>
      {detail.transcript.length === 0 ? (
        <p className="muted">No message was stored for this round.</p>
      ) : (
        <div className="card transcript">
          {detail.transcript.map((message, index) => {
            const first = index === 0 || detail.transcript[index - 1].turn !== message.turn;
            return (
              <div key={`${message.turn}-${message.role}`} className="game-turn">
                {first ? <span className="turn-label">Message {message.turn}</span> : null}
                <MessageBubble role={message.role === "user" ? "user" : "assistant"} content={message.content} />
              </div>
            );
          })}
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
                <th>Origin</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {detail.guesses.map((guess) => (
                <tr key={guess.turn}>
                  <td>{guess.turn}</td>
                  <td>{guess.guessedModel ?? "–"}</td>
                  <td>{guess.guessedOrigin ?? "–"}</td>
                  <td>
                    <span className={`pill status-${guess.modelCorrect ? "solved" : "miss"}`}>{guess.modelCorrect ? "Right" : "Wrong"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lines.length > 0 || explanation.length > 0 ? (
        <>
          <h2>Score</h2>
          {lines.length > 0 ? (
            <div className="card roster-card">
              <table className="roster compact">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Points</th>
                    <th>Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.label}>
                      <td>{line.label}</td>
                      <td>{line.points === null ? "–" : line.points.toLocaleString("en-US")}</td>
                      <td>{line.multiplier ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {explanation.length > 0 ? (
            <ul className="muted game-explain">
              {explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
