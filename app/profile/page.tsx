import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import type { GameStatus } from "@/lib/game";
import { loadHistory, loadProfileStats, profilePageSize } from "@/lib/profile-data";
import type { ProfileStats } from "@/lib/profile";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

function profileHref(page: number, gameId?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (gameId) params.set("game", gameId);
  const query = params.toString();
  return query ? `/profile?${query}` : "/profile";
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
  searchParams: Promise<{ page?: string; game?: string }>;
}) {
  const params = await searchParams;
  const { user, username, avatarUrl } = await currentProfile();
  if (!user) redirect("/login?next=/profile");
  if (!username) redirect("/welcome?next=/profile");

  const stats = await loadProfileStats(user.id);
  const requested = Number(params.page);
  const history = await loadHistory(user.id, Number.isFinite(requested) ? requested : 1, params.game ?? null);
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
          <ul className="history">
            {history.rows.map((row) => (
              <li key={row.id}>
                <a href={profileHref(shownPage, row.id)} aria-current={history.summary?.id === row.id ? "true" : undefined}>
                  <span>{formatWhen(row.startedAt)}</span>
                  <span>{statusLabel(row.status)}</span>
                  <span>{row.score === null ? "—" : row.score.toLocaleString("en-US")}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="row pager">
            <div className="row">
              {shownPage > 1 ? (
                <a className="button-quiet" href={profileHref(shownPage - 1)}>
                  Previous
                </a>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {shownPage} of {realPageCount}
              </span>
              {shownPage < realPageCount ? (
                <a className="button-quiet" href={profileHref(shownPage + 1)}>
                  Next
                </a>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
          </div>
        </>
      )}
      {history.summary ? (
        <section className="card">
          <h2>This game</h2>
          <dl className="summary-list">
            <dt>Date</dt>
            <dd>{formatWhen(history.summary.startedAt)}</dd>
            <dt>Model</dt>
            <dd>{history.summary.modelName ?? "Hidden until the round ends."}</dd>
            <dt>Status</dt>
            <dd>{statusLabel(history.summary.status)}</dd>
            <dt>Score</dt>
            <dd>{history.summary.score === null ? "—" : history.summary.score.toLocaleString("en-US")}</dd>
            <dt>Messages used</dt>
            <dd>{history.summary.messageCount}</dd>
            <dt>Company</dt>
            <dd>{history.summary.companyFound ? "Found" : "Not found"}</dd>
            <dt>Region</dt>
            <dd>{history.summary.regionFound ? "Found" : "Not found"}</dd>
          </dl>
          {history.summary.status === "active" ? (
            <p>
              <a href={`/play/${history.summary.id}`}>Continue</a>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
