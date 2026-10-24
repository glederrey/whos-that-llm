import { SectionNav } from "@/components/section-nav";
import { costFigures, Figures, Spend } from "@/components/admin-panels";
import { requireOwner } from "@/lib/admin-access";
import { compact, usd } from "@/lib/admin-metrics";
import { loadRoster } from "@/lib/admin-roster";
import { loadGameMetrics } from "@/lib/admin-stats";
import { loadOpenRouterSpend } from "@/lib/openrouter-spend";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  await requireOwner();
  const rosterPromise = loadRoster();
  const metricsPromise = loadGameMetrics();
  const roster = await rosterPromise;
  const spend = await loadOpenRouterSpend(
    new Date(),
    roster.rows.map((row) => row.openrouterId),
  );
  const metrics = await metricsPromise;
  const byId = new Map(roster.rows.map((row) => [row.id, row.name]));
  const byOpenRouterId = new Map(roster.rows.map((row) => [row.openrouterId, row.name]));
  const rosterById = new Map(roster.rows.map((row) => [row.id, row]));
  const byCost = [...metrics.models].sort((a, b) => b.costUsd - a.costUsd || a.modelId.localeCompare(b.modelId));

  return (
    <div className="stack">
      <SectionNav />
      <h1>Costs</h1>
      <h2>OpenRouter spend</h2>
      <p className="muted">
        What OpenRouter billed, read from OpenRouter when this page loads. Paid all time is this API key. Last 30 days
        and last 7 days include the current UTC day, and the table counts those same charges.
      </p>
      <Spend spend={spend} nameFor={(slug) => byOpenRouterId.get(slug) ?? byId.get(slug) ?? slug} />

      <h2>Our ledger</h2>
      <p className="muted">Cost and tokens saved from each OpenRouter reply. This is not the OpenRouter bill above.</p>
      <Figures items={costFigures(metrics)} />

      <h2>Spend by hidden model</h2>
      <p className="muted">
        The model that was the answer in the game. The name is shown here. All time, from our ledger, highest cost first.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Model</th>
              <th>Requests</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Cost per game</th>
            </tr>
          </thead>
          <tbody>
            {byCost.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No ledger rows yet.
                </td>
              </tr>
            ) : (
              byCost.map((row) => (
                <tr key={row.modelId}>
                  <td>{byId.get(row.modelId) ?? row.modelId}</td>
                  <td>
                    {row.requests.toLocaleString("en-US")}
                    {row.failedRequests > 0 ? <span className="muted"> ({row.failedRequests} failed)</span> : null}
                  </td>
                  <td>{compact(row.tokens)}</td>
                  <td>{usd(row.costUsd)}</td>
                  <td>{usd(row.costPerGame)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2>Reasoning by hidden model</h2>
      <p className="muted">
        Reasoning tokens per successful reply, from our ledger, highest average first. A reasoning model is sent the
        lowest effort, but some still think a lot, and those tokens are billed and eat the reply budget. To stop it,
        open the model on the <a href="/admin/models">Models</a> page, choose Edit and tick Turn reasoning off.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Model</th>
              <th>Setting</th>
              <th>Replies</th>
              <th>Average</th>
              <th>Highest</th>
              <th>Share of output</th>
            </tr>
          </thead>
          <tbody>
            {metrics.reasoning.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No reasoning tokens recorded yet.
                </td>
              </tr>
            ) : (
              metrics.reasoning.map((row) => (
                <tr key={row.modelId}>
                  <td>{byId.get(row.modelId) ?? row.modelId}</td>
                  <td>{rosterById.get(row.modelId)?.reasoningOff ? "Off" : "Lowest effort"}</td>
                  <td>{row.requests.toLocaleString("en-US")}</td>
                  <td>{row.avgReasoningTokens.toLocaleString("en-US")}</td>
                  <td>{row.maxReasoningTokens.toLocaleString("en-US")}</td>
                  <td>{row.share === null ? "-" : `${Math.round(row.share * 100)}%`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
