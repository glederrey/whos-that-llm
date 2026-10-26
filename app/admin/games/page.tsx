import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { listGames } from "@/lib/admin-game-data";

export const dynamic = "force-dynamic";

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOwner();
  const { q } = await searchParams;
  const rows = await listGames(q);

  return (
    <div className="stack">
      <SectionNav />
      <h1>Games</h1>
      <p className="muted">
        Open a round to read its whole conversation. Search by game id, or by part of a username. Without a search, the
        50 latest games.
      </p>
      <form method="get" className="chat-search">
        <label className="chat-query">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q ?? ""} maxLength={100} placeholder="Game id or username" />
        </label>
        <button type="submit">Search</button>
      </form>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Started (UTC)</th>
              <th>Player</th>
              <th>Mode</th>
              <th>Hidden model</th>
              <th>Status</th>
              <th>Messages</th>
              <th>Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No games match.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.startedAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{row.username ?? "Deleted account"}</td>
                  <td>{row.gameMode}</td>
                  <td>{row.modelName}</td>
                  <td>{row.status}</td>
                  <td>{row.messageCount}</td>
                  <td>{row.score ?? "–"}</td>
                  <td>
                    <a href={`/admin/games/${row.id}`}>Inspect</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
