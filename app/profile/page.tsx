import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { ProfileGames } from "@/components/profile-games";
import { ProfileForm } from "@/components/profile-form";
import type { ProfileStats } from "@/lib/profile";
import { loadHistory, loadHistoryFacets, loadProfileStats, profilePageSize } from "@/lib/profile-data";
import { historyItem } from "@/lib/profile-history";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Your username, picture, scores, and the rounds you have played. You can delete your account from here.",
};

function formatStat(stats: ProfileStats, key: keyof ProfileStats) {
  const value = stats[key];
  if (key === "solveRate") {
    return value === null ? "—" : `${Math.round((value as number) * 100)}%`;
  }
  if (value === null) return "—";
  const digits = key === "average" || key === "averageMessages" ? 1 : 0;
  return (value as number).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const { user, username, avatarUrl } = await currentProfile();
  if (!user) redirect("/login?next=/profile");
  if (!username) redirect("/welcome?next=/profile");

  const stats = await loadProfileStats(user.id);
  const [history, facets] = await Promise.all([loadHistory(user.id, 1), loadHistoryFacets(user.id)]);

  const figures: { label: string; key: keyof ProfileStats }[] = [
    { label: "Games played", key: "played" },
    { label: "Solved", key: "solved" },
    { label: "Failed", key: "missed" },
    { label: "Given up", key: "givenUp" },
    { label: "Solve rate", key: "solveRate" },
    { label: "Best score", key: "best" },
    { label: "Average score", key: "average" },
    { label: "Average messages", key: "averageMessages" },
  ];

  return (
    <div className="stack">
      <h1>Profile</h1>
      <ProfileForm username={username} avatarUrl={avatarUrl} userId={user.id} />
      <h2>Stats</h2>
      <dl className="stats profile-stats">
        {figures.map((figure) => (
          <div key={figure.key}>
            <dt>{figure.label}</dt>
            <dd>{formatStat(stats, figure.key)}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">Average messages is the mean on solved games. Solve rate is solved games divided by finished games.</p>
      <h2>Games</h2>
      <ProfileGames
        facets={facets}
        initial={{
          items: history.rows.map((row) => historyItem(row, history.best)),
          total: history.total,
          page: history.page,
          pageCount: Math.max(1, Math.ceil(history.total / profilePageSize())),
        }}
      />
      <DeleteAccountForm notice={params.notice} returnTo="profile" />
    </div>
  );
}
