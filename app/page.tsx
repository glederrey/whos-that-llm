import { redirect } from "next/navigation";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { ResetPassword } from "@/components/reset-password";
import { anyDifficulty } from "@/lib/difficulty";
import { boardChoice, boardHref, boardModes } from "@/lib/board-query";
import { landingSnapshot, leaderboard, listBoardOptions, listGameModes } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { organizationJsonLd } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string; gameMode?: string; period?: string; difficulty?: string }>;
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
  const board = await leaderboard(choice.gameMode, choice.period, user?.id, choice.difficulty);
  const top = "rows" in board ? board.rows.slice(0, 5) : [];

  return (
    <div className="stack landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <section className="hero">
        <img className="hero-logo for-light" src="/brand/logo-tail-right-light.png" alt="" />
        <img className="hero-logo for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
        <div className="stack">
          <h1>Guess the hidden AI model</h1>
          <p className="hero-copy">
            Think you can tell AI models apart, like a wine? In this guessing game, one of{" "}
            {snapshot.models.toLocaleString("en-US")} LLMs hides behind the chat. Ten messages, one guess. Take on the daily
            round or pick a game mode to climb the leaderboard.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="button button-lg" href="/play">
                Play
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
          <a href={boardHref("/leaderboard", choice)}>Full leaderboard</a>
        </div>
        <BoardControls base="/" modes={modes} categories={options.categories} companies={options.companies} {...choice} />
        {top.length === 0 ? (
          <div className="card empty">No finished games on this board yet.</div>
        ) : (
          <BoardTable rows={top} showDifficulty={choice.difficulty === anyDifficulty} />
        )}
      </section>
    </div>
  );
}
