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
  const [roster, metrics, spend] = await Promise.all([loadRoster(), loadGameMetrics(), loadOpenRouterSpend()]);
  const byId = new Map(roster.rows.map((row) => [row.id, row.name]));
  const byOpenRouterId = new Map(roster.rows.map((row) => [row.openrouterId, row.name]));
  const byCost = [...metrics.models].sort((a, b) => b.costUsd - a.costUsd || a.modelId.localeCompare(b.modelId));

  return (
    <div className="stack">
      <SectionNav />
      <h1>Costs</h1>
      <h2>OpenRouter spend</h2>
      <p className="muted">
        What OpenRouter billed, read from OpenRouter when this page loads. Totals come from the API key. The per-model
        breakdown is account activity for the last 30 completed UTC days.
      </p>
      <Spend spend={spend} nameFor={(slug) => byOpenRouterId.get(slug) ?? slug} />

      <h2>Our ledger</h2>
      <p className="muted">Cost and tokens saved from each OpenRouter reply. This is not the OpenRouter bill above.</p>
      <Figures items={costFigures(metrics)} />

      <h2>Spend by hidden model</h2>
      <p className="muted">All time, from our ledger, highest cost first.</p>
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
    </div>
  );
}
