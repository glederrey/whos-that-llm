import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const n = (value: number) => value.toLocaleString("en-US");

export default function ScoringPage() {
  const { hintCosts } = config;
  return (
    <div className="stack">
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>How scoring works</h1>
      <p className="lede">
        A round starts from a base. Penalties come off it, then the tokens the replies used stretch or shrink what is left.
      </p>
      <div className="card">
        <ol className="rule-list">
          <li>
            <strong>1. Base</strong>
            <span>
              Name the model, on any reply, and the base is {n(config.modelBase)}. How many messages you used does not change it. If you never
              name it, the base is the region ({n(config.regionPoints)}) and the company ({n(config.companyPoints)}) your guesses matched. A
              trait the round already showed you, or that you revealed, adds nothing.
            </span>
          </li>
          <li>
            <strong>2. Penalties</strong>
            <span>
              Each wrong guess costs {n(config.wrongGuessCost)}. A hint costs what its trait is worth: year {n(hintCosts.year)}, size{" "}
              {n(hintCosts.size)}, region {n(hintCosts.region)}, company {n(hintCosts.company)}, family {n(hintCosts.family)}. The right name
              is never a wrong guess. Earlier wrong names still count. Penalties are subtracted from the base, before the token factor.
            </span>
          </li>
          <li>
            <strong>3. Tokens</strong>
            <span>
              Multiply by {n(config.tokenScale)} divided by the tokens the replies used. Fewer tokens score higher. Anything under{" "}
              {n(config.tokenFloor)} tokens, including 0, counts as {n(config.tokenFloor)}, so the factor tops out at{" "}
              {n(config.tokenScale / config.tokenFloor)}.
            </span>
          </li>
          <li>
            <strong>4. No-hint mode</strong>
            <span>
              Play without hints and the roster never shrinks and no hint buttons are offered. A round played that way is multiplied by{" "}
              {config.noHintMultiplier}. Buying a hint means you are in the other mode, so there is no multiplier.
            </span>
          </li>
          <li>
            <strong>5. Rounding</strong>
            <span>The result rounds to the nearest whole number, halves up. It never goes below 0.</span>
          </li>
        </ol>
      </div>
      <h2>Hints</h2>
      <p>
        Company, family, region, year, and size can each be revealed once, after the first reply. A revealed trait is known from then on, and
        the guess list drops models that do not match it. A trait the round already showed you has no hint.
      </p>
      <h2>One round</h2>
      <p>
        Two replies used 500 tokens. The first name was wrong. You bought the year. The second name was the model. You were not in no-hint
        mode, because you bought a hint.
      </p>
      <pre className="formula">{`base      = 2,000                    (named the model)
penalties = 100 + 100 = 200          (year hint, one wrong guess)
tokens    = 1,000 / 500 = 2
score     = round((2,000 − 200) × 2)
          = 3,600`}</pre>
      <p className="muted">Your own result page lists the lines for that round.</p>
    </div>
  );
}
