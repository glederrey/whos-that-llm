import { redirect } from "next/navigation";
import { BoardTable } from "@/components/board-table";
import { ResetPassword } from "@/components/reset-password";
import { landingSnapshot } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  const resetting = params.reset === "1";
  if (user && !username && !resetting) redirect("/welcome");
  const signedIn = Boolean(user && username);
  const snapshot = await landingSnapshot(user?.id);

  return (
    <div className="stack landing">
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <section className="hero">
        <img className="hero-logo for-light" src="/brand/logo-tail-right-light.png" alt="" />
        <img className="hero-logo for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
        <div className="stack">
          <h1>Find the model.</h1>
          <p className="hero-copy">
            A hidden model answers you. You have ten messages. Name it when you want. Find it, and the round is yours. Miss
            the name, and the company and the region can still count.
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
          <p className="muted hero-note">The leaderboard is open to everyone. An account is only for playing.</p>
        </div>
      </section>
      <ol className="steps">
        <li>
          <span className="step-no">1</span>
          <strong>Ask anything</strong>
          <span>Ten messages with a model you cannot see.</span>
        </li>
        <li>
          <span className="step-no">2</span>
          <strong>Guess when you want</strong>
          <span>Name it, or stay in the chat. A guess is never forced.</span>
        </li>
        <li>
          <span className="step-no">3</span>
          <strong>Score high</strong>
          <span>Few tokens and few hints score the most.</span>
        </li>
      </ol>
      <p className="muted">
        Not knowing a recent model name is normal even for a new model, because a training cutoff lags the release, so that
        is not a reliable clue about age.
      </p>
      <dl className="stats">
        <div>
          <dt>Models in play</dt>
          <dd>{snapshot.models.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Games today (UTC)</dt>
          <dd>{snapshot.gamesToday.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>{snapshot.players.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <section className="stack">
        <div className="section-head">
          <h2>Top 5 · All models</h2>
          <a href="/leaderboard?category=all&period=all">Full leaderboard</a>
        </div>
        {snapshot.top.length === 0 ? (
          <div className="card empty">No finished games yet. Be the first on the board.</div>
        ) : (
          <BoardTable rows={snapshot.top} />
        )}
      </section>
    </div>
  );
}
