import { SectionNav } from "@/components/section-nav";
import { Figures } from "@/components/admin-panels";
import { requireOwner } from "@/lib/admin-access";
import { loadAdminStats } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireOwner();
  const stats = await loadAdminStats();
  const figures = [
    { label: "Models in the roster", value: stats.roster.toLocaleString("en-US") },
    { label: "Active models", value: stats.active.toLocaleString("en-US") },
    { label: "Players", value: stats.players.toLocaleString("en-US") },
    { label: "Games today (UTC)", value: stats.gamesToday.toLocaleString("en-US") },
    { label: "Total games", value: stats.games.toLocaleString("en-US") },
  ];

  return (
    <div className="stack">
      <SectionNav />
      <h1>Stats</h1>
      <Figures items={figures} />
      <p className="muted">
        Players are accounts that have started a game. Games today uses UTC. Costs, game results, and each mode are on
        their own pages.
      </p>
    </div>
  );
}
