import { SectionNav } from "@/components/section-nav";
import { loadAdminStats } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const stats = await loadAdminStats();
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
    </div>
  );
}
