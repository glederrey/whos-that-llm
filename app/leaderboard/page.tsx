import { leaderboard, listCategories } from "@/lib/rounds";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; period?: string }>;
}) {
  const params = await searchParams;
  const categories = await listCategories();
  const visible = categories.filter((category) => category.leaderboard && category.enabled);
  const category = visible.some((tab) => tab.id === params.category) ? (params.category as string) : (visible[0]?.id ?? "all");
  const period = params.period === "all" ? "all" : "week";
  const result = await leaderboard(category, period);
  const rows = "rows" in result ? result.rows : [];

  return (
    <div className="stack">
      <h1>Leaderboard</h1>
      <div className="tabs">
        {visible.map((tab) => (
          <a key={tab.id} className="button-quiet" aria-pressed={tab.id === category} href={`/leaderboard?category=${tab.id}&period=${period}`}>
            {tab.name}
          </a>
        ))}
      </div>
      <div className="tabs">
        <a className="button-quiet" aria-pressed={period === "week"} href={`/leaderboard?category=${category}&period=week`}>
          This week (UTC)
        </a>
        <a className="button-quiet" aria-pressed={period === "all"} href={`/leaderboard?category=${category}&period=all`}>
          All time
        </a>
      </div>
      {rows.length === 0 ? (
        <p>No finished games on this board yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rank}-${row.name}-${row.score}`}>
                  <td>{row.rank}</td>
                  <td>{row.name}</td>
                  <td>{row.score.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
