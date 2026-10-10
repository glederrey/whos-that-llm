import { SectionNav } from "@/components/section-nav";
import { loadAdminStats, loadRoster } from "@/lib/admin-roster";
import { fetchPublicModelPrices, type ModelPrice } from "@/lib/openrouter-prices";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const [stats, roster, prices] = await Promise.all([loadAdminStats(), loadRoster(), fetchPublicModelPrices()]);
  const figures: { label: string; value: number }[] = [
    { label: "Models in the roster", value: stats.roster },
    { label: "Active models", value: stats.active },
    { label: "Players", value: stats.players },
    { label: "Games today (UTC)", value: stats.gamesToday },
    { label: "Total games", value: stats.games },
  ];
  return (
    <div className="stack">
      <SectionNav />
      <h1>Stats</h1>
      <dl className="stats">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>{figure.value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">Players are accounts that have started a game. Games today uses UTC.</p>
      <h2>OpenRouter list price</h2>
      <p className="muted">Prompt and completion, per million tokens, from the public model list.</p>
      {prices ? (
        <div className="card roster-card">
          <table className="roster compact">
            <thead>
              <tr>
                <th>Model</th>
                <th>OpenRouter id</th>
                <th>Prompt</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {roster.rows.map((row) => {
                const price: ModelPrice | undefined = prices.get(row.openrouterId);
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.openrouterId}</td>
                    <td>{shownPrice(price?.prompt)}</td>
                    <td>{shownPrice(price?.completion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="error" role="alert">
          OpenRouter prices could not be loaded.
        </p>
      )}
    </div>
  );
}

function shownPrice(value: string | null | undefined) {
  return value ?? "No price";
}
