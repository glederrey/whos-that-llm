import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { ResetPassword } from "@/components/reset-password";
import { allCompanies } from "@/lib/company";
import { anyDifficulty } from "@/lib/difficulty";
import { boardChoice, boardHref, boardModes, selectedCompany } from "@/lib/board-query";
import { landingSnapshot, leaderboard, listBoardOptions, listGameModes } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { organizationJsonLd } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "A guessing game for AI fans. Chat with a hidden LLM for ten messages and guess which model it is. Daily rounds, several game modes, and a public leaderboard.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string; gameMode?: string; period?: string; difficulty?: string; company?: string }>;
}) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  const resetting = params.reset === "1";
  if (user && !username && !resetting) redirect("/welcome");
  const signedIn = Boolean(user && username);
  const [snapshot, gameModes, options] = await Promise.all([landingSnapshot(), listGameModes(), listBoardOptions()]);
  const modes = boardModes(gameModes);
  const choice = boardChoice(params, modes);
  const view = {
    ...choice,
    company: choice.gameMode === "company" ? selectedCompany(choice.company, options.companies) : allCompanies,
  };
  const board = await leaderboard(
    view.gameMode,
    view.period,
    user?.id,
    view.difficulty,
    view.gameMode === "company" && view.company !== allCompanies ? view.company : null,
  );
  const top = "rows" in board ? board.rows.slice(0, 5) : [];

  return (
    <div className="stack landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <section className="hero">
        <img className="hero-logo for-light" src="/brand/logo-tail-right-light.png" alt="" />
        <img className="hero-logo for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
        <div className="stack">
          <h1>
            <span className="title-full">Guess the hidden AI model</span>
            <span className="title-phone">Guess the AI model</span>
          </h1>
          <p className="hero-copy">
            Think you can tell AI models apart, like a wine? In this guessing game, a hidden LLM answers you. It could be
            ChatGPT, Claude, Gemini, or any of the {snapshot.models.toLocaleString("en-US")} models in play. Ten messages, one
            guess. Take on the daily round or pick a game mode to climb the leaderboard.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="button button-lg" href="/play">
                Start playing
              </a>
            ) : (
              <>
                <a className="button button-lg" href="/login?tab=create&next=/play">
                  Sign up
                </a>
                <a className="button-quiet button-lg" href="/login?next=/play">
                  Sign in
                </a>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="how-round">
        <h2 className="how-round-title">How a round works</h2>
        <ol className="steps">
          <li>
            <span className="step-no">1</span>
            <strong>Ask anything</strong>
            <span className="step-text">Ten messages with a model you cannot see.</span>
          </li>
          <li>
            <span className="step-no">2</span>
            <strong>Guess when you want</strong>
            <span className="step-text">Name it, or stay in the chat.</span>
          </li>
          <li>
            <span className="step-no">3</span>
            <strong>Score high</strong>
            <span className="step-text">Few tokens and few hints score the most.</span>
          </li>
        </ol>
      </section>
      <dl className="stats">
        <div>
          <dt>Models in play</dt>
          <dd>{snapshot.models.toLocaleString("en-US")}</dd>
        </div>
        <div className="stat-companies">
          <dt>Companies</dt>
          <dd>{snapshot.companies.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Games today</dt>
          <dd>{snapshot.gamesToday.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>{snapshot.players.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <section className="stack">
        <div className="section-head">
          <h2>Top 5</h2>
          <a href={boardHref("/leaderboard", view)}>Full leaderboard</a>
        </div>
        <BoardControls base="/" modes={modes} categories={options.categories} companies={options.companies} {...view} />
        {top.length === 0 ? (
          <div className="card empty">No finished games on this board yet.</div>
        ) : (
          <BoardTable
            rows={top}
            showDifficulty={view.gameMode !== "company" && view.difficulty === anyDifficulty}
            showCompany={view.gameMode === "company"}
          />
        )}
      </section>
    </div>
  );
}
