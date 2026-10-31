import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { landingSnapshot } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";
import { organizationJsonLd } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "A guessing game for AI fans. Chat with a hidden LLM for ten messages and guess which model it is. Daily rounds, several game modes, and a public leaderboard.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  if (user && !username) redirect("/welcome");
  const signedIn = Boolean(user && username);
  const snapshot = await landingSnapshot();

  return (
    <div className="stack landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <img className="for-light" src="/brand/logo-tail-right-light.png" alt="" />
          <img className="for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
          <div className="hero-talk">
            <div className="bubble user">Who are you, really?</div>
            <div className="bubble assistant">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        </div>
        <div className="hero-text">
          <h1>Which AI is it?</h1>
          <p className="hero-copy">
            Chat with a hidden model for ten messages, then name it: ChatGPT, Claude, Gemini, or one of{" "}
            {Math.max(snapshot.models - 3, 0).toLocaleString("en-US")} others. The fewer messages and hints you use, the more you score.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="button button-lg" href="/play">
                Start playing
              </a>
            ) : (
              <>
                <a className="button button-lg" href="/login?tab=create&next=/play">
                  Play now
                </a>
                <a className="button-quiet button-lg" href="/login?next=/play">
                  Sign in
                </a>
              </>
            )}
          </div>
        </div>
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
      <p className="hero-more">
        <a href="/leaderboard">See who is winning on the leaderboard</a>
      </p>
    </div>
  );
}
