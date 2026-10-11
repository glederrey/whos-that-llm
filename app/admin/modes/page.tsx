import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { percent } from "@/lib/admin-metrics";
import { loadModeStats } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export default async function ModesPage() {
  await requireOwner();
  const modes = await loadModeStats();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Modes</h1>
      <p className="muted">
        Each game category, including ones that are not open yet. Solve rate is solved over finished games. A class
        leaderboard is not a row here.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Games</th>
              <th>Open</th>
              <th>Finished</th>
              <th>Solved</th>
              <th>Solve rate</th>
              <th>Give-ups</th>
            </tr>
          </thead>
          <tbody>
            {modes.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No modes yet.
                </td>
              </tr>
            ) : (
              modes.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.games.toLocaleString("en-US")}</td>
                  <td>{row.open.toLocaleString("en-US")}</td>
                  <td>{row.finished.toLocaleString("en-US")}</td>
                  <td>{row.solved.toLocaleString("en-US")}</td>
                  <td>{percent(row.solveRate)}</td>
                  <td>{row.givenUp.toLocaleString("en-US")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
