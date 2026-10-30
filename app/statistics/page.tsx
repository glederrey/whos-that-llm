import type { Metadata } from "next";
import { StatisticsBoard } from "@/components/statistics-board";
import { loadPublicStats } from "@/lib/public-stats-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Figures from played rounds: how often players solve, give up, or miss, and which hidden models are the hardest to name.",
};

export default async function StatisticsPage() {
  const { stats, names, origins } = await loadPublicStats();

  return (
    <div className="stack">
      <h1>Statistics</h1>
      <StatisticsBoard stats={stats} names={names} origins={origins} />
    </div>
  );
}
