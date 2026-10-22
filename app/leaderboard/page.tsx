import type { Metadata } from "next";
import Link from "next/link";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { allCompanies } from "@/lib/company";
import { anyDifficulty } from "@/lib/difficulty";
import { boardChoice, boardHref, boardModes, boardPool, isPoolBoard, selectedCategory, selectedCompany } from "@/lib/board-query";
import { leaderboard, listBoardOptions, listGameModes } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "The highest scores from finished rounds. Choose a game mode, then this week, this month, or all time, and a difficulty or a company.",
};

const pageSize = 20;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gameMode?: string; period?: string; page?: string; difficulty?: string; company?: string; category?: string }>;
}) {
  const params = await searchParams;
  const { user } = await currentProfile();
  const [gameModes, options] = await Promise.all([listGameModes(), listBoardOptions()]);
  const modes = boardModes(gameModes);
  const choice = boardChoice(params, modes);
  const view = {
    ...choice,
    company: choice.gameMode === "company" ? selectedCompany(choice.company, options.companies) : allCompanies,
    category: choice.gameMode === "class" ? selectedCategory(choice.category, options.categories) : allCompanies,
  };
  const result = await leaderboard(
    view.gameMode,
    view.period,
    user?.id,
    view.difficulty,
    boardPool(view),
  );
  const rows = "rows" in result ? result.rows : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requested = Number(params.page);
  const page = Number.isFinite(requested) && requested >= 1 ? Math.min(Math.trunc(requested), pageCount) : 1;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);
  const mineIndex = rows.findIndex((row) => row.mine);
  const minePage = mineIndex >= 0 ? Math.floor(mineIndex / pageSize) + 1 : null;

  return (
    <div className="stack">
      <a className="back" href={boardHref("/", view)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Leaderboard</h1>
      <BoardControls base="/leaderboard" modes={modes} categories={options.categories} companies={options.companies} {...view} />
      {rows.length === 0 ? (
        <div className="card empty">No finished games on this board yet.</div>
      ) : (
        <>
          <BoardTable
            rows={slice}
            showDifficulty={!isPoolBoard(view.gameMode) && view.difficulty === anyDifficulty}
            showCompany={isPoolBoard(view.gameMode)}
          />
          <div className="row pager">
            <div className="row">
              {page > 1 ? (
                <Link className="button-quiet" href={boardHref("/leaderboard", view, page - 1)} scroll={false}>
                  Previous
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="button-quiet" href={boardHref("/leaderboard", view, page + 1)} scroll={false}>
                  Next
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
            {minePage && minePage !== page ? (
              <Link className="button" href={boardHref("/leaderboard", view, minePage)} scroll={false}>
                Your place
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
