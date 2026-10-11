import Link from "next/link";
import { BoardTable } from "@/components/board-table";
import { anyDifficulty, difficulties, difficultyLabel, parseBoardDifficulty, type BoardDifficulty } from "@/lib/difficulty";
import { leaderboard, listCategories } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const pageSize = 20;

function boardHref(category: string, period: string, page: number, difficulty: BoardDifficulty | null) {
  const params = new URLSearchParams({ category, period });
  if (difficulty) params.set("difficulty", difficulty);
  if (page > 1) params.set("page", String(page));
  return `/leaderboard?${params.toString()}`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; period?: string; page?: string; difficulty?: string }>;
}) {
  const params = await searchParams;
  const { user } = await currentProfile();
  const categories = await listCategories();
  const visible = categories.filter((category) => category.leaderboard && category.enabled);
  const category = visible.some((tab) => tab.id === params.category) ? (params.category as string) : (visible[0]?.id ?? "all");
  const period = params.period === "all" ? "all" : "week";
  const difficulty = category === "all" ? parseBoardDifficulty(params.difficulty) : null;
  const result = await leaderboard(category, period, user?.id, difficulty);
  const rows = "rows" in result ? result.rows : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requested = Number(params.page);
  const page = Number.isFinite(requested) && requested >= 1 ? Math.min(Math.trunc(requested), pageCount) : 1;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  const mineIndex = rows.findIndex((row) => row.mine);
  const minePage = mineIndex >= 0 ? Math.floor(mineIndex / pageSize) + 1 : null;

  return (
    <div className="stack">
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Leaderboard</h1>
      <div className="filters">
        {visible.length > 1 ? (
          <div className="segmented" role="group" aria-label="Category">
            {visible.map((tab) => (
              <a key={tab.id} aria-pressed={tab.id === category} href={boardHref(tab.id, period, 1, tab.id === "all" ? difficulty ?? anyDifficulty : null)}>
                {tab.name}
              </a>
            ))}
          </div>
        ) : null}
        {category === "all" ? (
          <div className="segmented" role="group" aria-label="Difficulty">
            <a aria-pressed={difficulty === anyDifficulty} href={boardHref(category, period, 1, anyDifficulty)}>
              Any difficulty
            </a>
            {difficulties.map((tab) => (
              <a key={tab} className={`difficulty-${tab}`} aria-pressed={tab === difficulty} href={boardHref(category, period, 1, tab)}>
                {difficultyLabel[tab]}
              </a>
            ))}
          </div>
        ) : null}
        <div className="segmented" role="group" aria-label="Period">
          <a aria-pressed={period === "week"} href={boardHref(category, "week", 1, difficulty)}>
            This week (UTC)
          </a>
          <a aria-pressed={period === "all"} href={boardHref(category, "all", 1, difficulty)}>
            All time
          </a>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="card empty">No finished games on this board yet.</div>
      ) : (
        <>
          <BoardTable rows={slice} showDifficulty={difficulty === anyDifficulty} />
          <div className="row pager">
            <div className="row">
              {page > 1 ? (
                <Link className="button-quiet" href={boardHref(category, period, page - 1, difficulty)} scroll={false}>
                  Previous
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="button-quiet" href={boardHref(category, period, page + 1, difficulty)} scroll={false}>
                  Next
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
            {minePage && minePage !== page ? (
              <Link className="button" href={boardHref(category, period, minePage, difficulty)} scroll={false}>
                Your place
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
