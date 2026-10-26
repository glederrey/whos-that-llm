import { SortTable } from "@/components/sort-table";
import { SectionNav } from "@/components/section-nav";
import { Figures } from "@/components/admin-panels";
import { DayBars } from "@/components/day-bars";
import { requireOwner } from "@/lib/admin-access";
import { percent, usd } from "@/lib/admin-metrics";
import { failureLimit } from "@/lib/admin-insights";
import { loadAdminInsights } from "@/lib/admin-stats";
import { loadAdminStats } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

const hintNames: Record<string, string> = {
  year: "Release year",
  size: "Size",
  origin: "Origin",
  company: "Company",
};

export default async function AdminHomePage() {
  await requireOwner();
  const [stats, insights] = await Promise.all([loadAdminStats(), loadAdminInsights()]);
  const figures = [
    { label: "Models in the roster", value: stats.roster.toLocaleString("en-US") },
    { label: "Active models", value: stats.active.toLocaleString("en-US") },
    { label: "Players", value: stats.players.toLocaleString("en-US") },
    { label: "Games today (UTC)", value: stats.gamesToday.toLocaleString("en-US") },
    { label: "Total games", value: stats.games.toLocaleString("en-US") },
    {
      label: "Total cost",
      value: usd(insights.cost.total),
    },
  ];
  const { hints } = insights;

  return (
    <div className="stack">
      <SectionNav />
      <h1>Stats</h1>
      <Figures items={figures} />
      <p className="muted">
        Players are accounts that have started a game. Games today counts finished games, in UTC, like the home page.
        Solve rates, models and modes are on the public Statistics page; costs and each mode are on their own pages.
      </p>

      <h2>Games over time</h2>
      <DayBars
        days={insights.days}
        label="Games started per UTC day, last 14 days, in every mode"
        note="Games started per UTC day, last 14 days, in every mode. The teal part is still open."
        showOpen
      />

      <h2>Players per day</h2>
      <p className="muted">
        New accounts, accounts that started a game, and games started.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Day (UTC)</th>
              <th>New accounts</th>
              <th>Active players</th>
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            {[...insights.playerDays].reverse().map((day) => (
              <tr key={day.date}>
                <td>{day.date}</td>
                <td>{day.newAccounts}</td>
                <td>{day.activePlayers}</td>
                <td>{day.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Rounds per player</h2>
      <p className="muted">
        {insights.players.toLocaleString("en-US")} accounts finished at least one game.{" "}
        {insights.returning.toLocaleString("en-US")} played on two different days or more.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Finished games</th>
              <th>Players</th>
            </tr>
          </thead>
          <tbody>
            {insights.rounds.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.players.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Open and abandoned rounds</h2>
      <p className="muted">Rounds still marked open, by how long ago they started.</p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Under a day</th>
              <th>1 to 7 days</th>
              <th>Over 7 days</th>
            </tr>
          </thead>
          <tbody>
            {insights.openRounds.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.fresh}</td>
                <td>{row.week}</td>
                <td>{row.stale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Hint use</h2>
      <p className="muted">
        Share of rounds where each hint was used, among {(hints.eligible - hints.noHint).toLocaleString("en-US")} rounds
        that allowed hints. {hints.noHint.toLocaleString("en-US")} more were played with no hints. Origin rounds have
        no hints and are left out.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Hint</th>
              <th>Rounds</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {hints.rows.map((row) => (
              <tr key={row.hint}>
                <td>{hintNames[row.hint] ?? row.hint}</td>
                <td>{row.rounds.toLocaleString("en-US")}</td>
                <td>{percent(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Cost per mode</h2>
      <p className="muted">
        Our ledger spend on each mode's rounds, over its finished games. Ledger rows with no game are left out. Click a
        header to reorder.
      </p>
      <SortTable
        columns={[
          { label: "Mode" },
          { label: "Finished games", numeric: true },
          { label: "Spend", numeric: true },
          { label: "Per finished game", numeric: true },
        ]}
        rows={insights.modeCosts.map((row) => ({
          id: row.id,
          cells: [
            { text: row.name, sort: row.name },
            { text: row.finished.toLocaleString("en-US"), sort: row.finished },
            { text: usd(row.spend), sort: row.spend },
            { text: row.perGame === null ? "-" : usd(row.perGame), sort: row.perGame },
          ],
        }))}
      />

      <h2>Failed calls by model</h2>
      <p className="muted">The {failureLimit} models with the most failed calls in our ledger.</p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Model</th>
              <th>Calls</th>
              <th>Failed</th>
              <th>Rate</th>
              <th>Most common error</th>
              <th>Last failure</th>
            </tr>
          </thead>
          <tbody>
            {insights.failures.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No failed calls.
                </td>
              </tr>
            ) : (
              insights.failures.map((row) => (
                <tr key={row.modelId}>
                  <td>{row.name}</td>
                  <td>{row.calls.toLocaleString("en-US")}</td>
                  <td>{row.failed.toLocaleString("en-US")}</td>
                  <td>{percent(row.rate)}</td>
                  <td>{row.topError}</td>
                  <td>{row.lastFailure.slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2>Roster coverage</h2>
      <p className="muted">
        Every active model and how often it was drawn as the hidden model, most drawn first, 10 per page.{" "}
        {insights.neverDrawn.toLocaleString("en-US")} have never been drawn. Click a header to reorder.
      </p>
      <SortTable
        columns={[{ label: "Model" }, { label: "Games", numeric: true }, { label: "Last drawn", numeric: true }]}
        initial={{ column: 1, dir: "desc" }}
        pageSize={10}
        rows={insights.coverage.map((row) => ({
          id: row.modelId,
          cells: [
            { text: row.name, sort: row.name },
            { text: row.games.toLocaleString("en-US"), sort: row.games },
            { text: row.lastDrawn ? row.lastDrawn.slice(0, 10) : "never", sort: row.lastDrawn },
          ],
        }))}
      />
    </div>
  );
}
