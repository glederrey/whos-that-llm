import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { pageNumber } from "@/lib/admin-game";
import { gamesPerPage, listGames } from "@/lib/admin-game-data";

export const dynamic = "force-dynamic";

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireOwner();
  const { q, page: rawPage } = await searchParams;
  const requested = pageNumber(rawPage);
  const pageCount = (total: number) => Math.max(1, Math.ceil(total / gamesPerPage));
  let { rows, total } = await listGames(q, requested);
  // A page past the end (a stale link) shows the last one.
  const last = pageCount(total);
  if (requested > last) ({ rows, total } = await listGames(q, last));
  const page = Math.min(requested, last);
  const href = (target: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return `/admin/games${query ? `?${query}` : ""}`;
  };

  return (
    <div className="stack">
      <SectionNav />
      <h1>Games</h1>
      <p className="muted">
        Open a round to read its whole conversation. Search by game id, or by part of a username. Without a search, the
        latest games, 10 per page.
      </p>
      <form method="get" className="chat-search">
        <label className="chat-query">
          <span>Search</span>
          <input type="search" name="q" defaultValue={q ?? ""} maxLength={100} placeholder="Game id or username" />
        </label>
        <button type="submit" className="button">
          Search
        </button>
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
      <div className="row pager">
        <div className="row">
          {page > 1 ? (
            <a className="button-quiet" href={href(page - 1)}>
              Previous
            </a>
          ) : (
            <span className="button-quiet is-disabled">Previous</span>
          )}
          <span className="muted">
            Page {page} of {last}
          </span>
          {page < last ? (
            <a className="button-quiet" href={href(page + 1)}>
              Next
            </a>
          ) : (
            <span className="button-quiet is-disabled">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
