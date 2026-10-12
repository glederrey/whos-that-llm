import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { HistoryList } from "@/components/history-list";
import { ProfileForm } from "@/components/profile-form";
import type { GameStatus } from "@/lib/game";
import { loadHistory, loadProfileStats, profilePageSize } from "@/lib/profile-data";
import { isBestGame, type ProfileStats } from "@/lib/profile";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

function profileHref(page: number) {
  return page > 1 ? `/profile?page=${page}` : "/profile";
}

function formatWhen(iso: string) {
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${formatted} UTC`;
}

function formatStat(stats: ProfileStats, key: keyof ProfileStats) {
  const value = stats[key];
  if (key === "solveRate") {
    return value === null ? "—" : `${Math.round((value as number) * 100)}%`;
  }
  if (value === null) return "—";
  const digits = key === "average" || key === "averageMessages" ? 1 : 0;
  return (value as number).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function statusLabel(status: GameStatus) {
  if (status === "solved") return "Solved";
  if (status === "miss") return "Miss";
  if (status === "given_up") return "Given up";
  return "In progress";
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const { user, username, avatarUrl } = await currentProfile();
  if (!user) redirect("/login?next=/profile");
  if (!username) redirect("/welcome?next=/profile");

  const stats = await loadProfileStats(user.id);
  const requested = Number(params.page);
  const history = await loadHistory(user.id, Number.isFinite(requested) ? requested : 1);
  const shownPage = history.page;
  const realPageCount = Math.max(1, Math.ceil(history.total / profilePageSize()));

  const figures: { label: string; key: keyof ProfileStats }[] = [
    { label: "Games played", key: "played" },
    { label: "Solved", key: "solved" },
    { label: "Missed", key: "missed" },
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
      {history.rows.length === 0 ? (
        <div className="card empty">No games yet.</div>
      ) : (
        <>
          <HistoryList
            key={shownPage}
            items={history.rows.map((row) => ({
              id: row.id,
              when: formatWhen(row.startedAt),
              status: statusLabel(row.status),
              state: row.status,
              score: row.score === null ? "—" : row.score.toLocaleString("en-US"),
              best: isBestGame(row, stats.best),
              messages: row.messageCount,
              tokens: row.tokens.toLocaleString("en-US"),
              modelName: row.modelName,
              companyName: row.companyName,
              logoPath: row.logoPath,
              companyFound: row.companyFound,
              regionFound: row.regionFound,
              mode: row.mode,
              difficulty: row.difficulty,
            }))}
          />
          <div className="row pager">
            <div className="row">
              {shownPage > 1 ? (
                <Link className="button-quiet" href={profileHref(shownPage - 1)} scroll={false}>
                  Previous
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {shownPage} of {realPageCount}
              </span>
              {shownPage < realPageCount ? (
                <Link className="button-quiet" href={profileHref(shownPage + 1)} scroll={false}>
                  Next
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
          </div>
        </>
      )}
      <DeleteAccountForm notice={params.notice} returnTo="profile" />
    </div>
  );
}
