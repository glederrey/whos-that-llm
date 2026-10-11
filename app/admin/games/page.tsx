import { SectionNav } from "@/components/section-nav";
import { DayBars, Figures, playFigures } from "@/components/admin-panels";
import { requireOwner } from "@/lib/admin-access";
import { decimal, percent } from "@/lib/admin-metrics";
import { loadRoster } from "@/lib/admin-roster";
import { loadGameMetrics } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  await requireOwner();
  const [roster, metrics] = await Promise.all([loadRoster(), loadGameMetrics()]);
  const byId = new Map(roster.rows.map((row) => [row.id, row.name]));

  return (
    <div className="stack">
      <SectionNav />
      <h1>Games</h1>
      <p className="muted">
        From our own tables. Rates use finished games: solved, missed, and given up. Tokens are the figures OpenRouter
        returned with each reply.
      </p>
      <Figures items={playFigures(metrics)} />

      <h2>Games over time</h2>
      <DayBars days={metrics.days} />

      <h2>Which models are hardest to find</h2>
      <p className="muted">Hidden models, hardest first. Solve rate is solved over finished games.</p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Hidden model</th>
              <th>Games</th>
              <th>Solve rate</th>
              <th>Messages when solved</th>
            </tr>
          </thead>
          <tbody>
            {metrics.models.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No games yet.
                </td>
              </tr>
            ) : (
              metrics.models.map((row) => (
                <tr key={row.modelId}>
                  <td>{byId.get(row.modelId) ?? row.modelId}</td>
                  <td>
                    {row.games.toLocaleString("en-US")}
                    {row.finished !== row.games ? <span className="muted"> ({row.finished} finished)</span> : null}
                  </td>
                  <td>{percent(row.solveRate)}</td>
                  <td>{decimal(row.avgMessagesWhenSolved)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
