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
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Statistics</h1>
      <StatisticsBoard stats={stats} names={names} origins={origins} />
    </div>
  );
}
