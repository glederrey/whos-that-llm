import Link from "next/link";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { anyDifficulty } from "@/lib/difficulty";
import { boardChoice, boardHref } from "@/lib/board-query";
import { leaderboard, listCategories } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const pageSize = 20;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; period?: string; page?: string; difficulty?: string }>;
}) {
  const params = await searchParams;
  const { user } = await currentProfile();
  const categories = await listCategories();
  const choice = boardChoice(params, categories.map((category) => category.id));
  const result = await leaderboard(choice.category, choice.period, user?.id, choice.difficulty);
  const rows = "rows" in result ? result.rows : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requested = Number(params.page);
  const page = Number.isFinite(requested) && requested >= 1 ? Math.min(Math.trunc(requested), pageCount) : 1;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  const mineIndex = rows.findIndex((row) => row.mine);
  const minePage = mineIndex >= 0 ? Math.floor(mineIndex / pageSize) + 1 : null;

  return (
    <div className="stack">
      <a className="back" href={boardHref("/", choice)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Leaderboard</h1>
      <BoardControls base="/leaderboard" modes={categories} {...choice} />
      {rows.length === 0 ? (
        <div className="card empty">No finished games on this board yet.</div>
      ) : (
        <>
          <BoardTable rows={slice} showDifficulty={choice.difficulty === anyDifficulty} />
          <div className="row pager">
            <div className="row">
              {page > 1 ? (
                <Link className="button-quiet" href={boardHref("/leaderboard", choice, page - 1)} scroll={false}>
                  Previous
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="button-quiet" href={boardHref("/leaderboard", choice, page + 1)} scroll={false}>
                  Next
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
            {minePage && minePage !== page ? (
              <Link className="button" href={boardHref("/leaderboard", choice, minePage)} scroll={false}>
                Your place
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
