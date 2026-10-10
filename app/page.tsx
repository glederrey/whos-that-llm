import { redirect } from "next/navigation";
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
    <div className="stack">
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <section className="hero">
        <img className="hero-logo for-light" src="/brand/logo-light.png" alt="" />
        <img className="hero-logo for-dark" src="/brand/logo-dark.png" alt="" />
        <div className="stack">
          <h1>Find the model.</h1>
          <p>
            A hidden model answers you. You have ten messages. Name it when you want. Find it, and the round is yours. Miss
            the name, and the company and the region can still count.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="button" href="/play">
                Play
              </a>
            ) : (
              <>
                <a className="button" href="/login?tab=create&next=/play">
                  Sign up
                </a>
                <a className="button-quiet" href="/login?next=/play">
                  Sign in
                </a>
              </>
            )}
          </div>
          <p className="muted">
            The leaderboard is open to everyone. An account is only for playing.{" "}
            <a href="/scoring">How scoring works</a>
          </p>
        </div>
      </section>
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
        <h2>Top 5 · All models</h2>
        {snapshot.top.length === 0 ? (
          <p>No finished games yet.</p>
        ) : (
          <table className="board">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.top.map((row) => (
                <tr key={row.rank} className={row.mine ? "mine" : undefined}>
                  <td>{row.rank}</td>
                  <td>{row.name}</td>
                  <td>{row.score.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>
          <a href="/leaderboard?category=all&period=all">Full leaderboard</a>
        </p>
      </section>
    </div>
  );
}
