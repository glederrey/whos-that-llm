import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { currentProfile } from "@/lib/session";
import { landingSnapshot } from "@/lib/rounds";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };
import { RevealDemo } from "@/components/hero-demos";

/** Idea 1: show the game. A looping example round that ends on the reveal, which is the moment players come for. */
export default async function Hero1() {
  const { user, username } = await currentProfile();
  const snapshot = await landingSnapshot();
  return (
    <div className="stack landing">
      <section className="h1-hero">
        <div className="h1-text">
          <h1>
            Spot the <span className="h1-mark">AI</span>.
          </h1>
          <p className="hero-copy">
            Ten messages with a hidden model. Ask anything, then name it. You will be surprised how close they sound, and how
            fast you start to hear the differences.
          </p>
          <HeroCta signedIn={Boolean(user && username)} label="Try a round" />
          <p className="h1-proof">
            {snapshot.models.toLocaleString("en-US")} models · {snapshot.companies.toLocaleString("en-US")} companies ·{" "}
            {snapshot.players.toLocaleString("en-US")} players so far
          </p>
        </div>
        <RevealDemo />
      </section>
    </div>
  );
}
