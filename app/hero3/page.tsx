import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { currentProfile } from "@/lib/session";
import { landingSnapshot } from "@/lib/rounds";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };
import { listBoardOptions } from "@/lib/rounds";

/** Idea 3: the blind tasting. Every lab in the roster scrolls past, unlabeled by model, and you taste to tell them apart. */
export default async function Hero3() {
  const { user, username } = await currentProfile();
  const [snapshot, options] = await Promise.all([landingSnapshot(), listBoardOptions()]);
  const labs = options.companies;
  const rowA = labs;
  const rowB = [...labs].reverse();
  const lane = (items: typeof labs, reverse: boolean) => (
    <div className="h3-lane" data-reverse={reverse} aria-hidden="true">
      <div className="h3-track">
        {[0, 1].map((copy) => (
          <div className="h3-set" key={copy}>
            {items.map((lab) => (
              <span className="h3-chip" key={`${copy}-${lab.id}`}>
                {lab.logoUrl ? <img src={lab.logoUrl} alt="" width={22} height={22} /> : null}
                {lab.name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="stack landing">
      <section className="h3-hero">
        <div className="h3-text">
          <h1>Can you taste the difference?</h1>
          <p className="hero-copy">
            Wine people name the grape from one sip. Can you name the model from a few messages? {snapshot.models.toLocaleString("en-US")}{" "}
            of them are hiding. No labels.
          </p>
          <HeroCta signedIn={Boolean(user && username)} label="Pour the first glass" />
        </div>
        <div className="h3-lanes">
          {lane(rowA, false)}
          {lane(rowB, true)}
        </div>
        <ul className="h3-steps">
          <li><strong>Ten</strong> messages</li>
          <li><strong>One</strong> guess</li>
          <li><strong>Zero</strong> labels</li>
        </ul>
      </section>
    </div>
  );
}
