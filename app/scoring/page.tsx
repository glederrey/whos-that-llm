import { config, rulesForCategory } from "@/lib/config";
import { formatFactor, scoreRound, tokenFactor } from "@/lib/game";

export const dynamic = "force-dynamic";

const n = (value: number) => value.toLocaleString("en-US");

const exampleTokens = 2694;
const exampleRules = rulesForCategory(true);
const exampleSubtotal = config.modelBase - config.hintCosts.size - config.wrongGuessCost;
const exampleFactor = tokenFactor(exampleTokens, exampleRules);
const example = scoreRound({
  rules: exampleRules,
  namedModel: true,
  regionMatched: false,
  companyMatched: false,
  regionGiven: false,
  companyGiven: false,
  tokens: exampleTokens,
  noHint: false,
  hints: ["size"],
  wrongGuesses: 1,
  difficulty: "medium",
});

export default function ScoringPage() {
  const { hintCosts } = config;
  const capAt = config.tokenScale / config.tokenCap;
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
        A round starts from a base. Penalties come off it. That subtotal is multiplied by the token factor, then by the no-hint multiplier when
        it applies, then by the difficulty.
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
              {n(hintCosts.size)}, region {n(hintCosts.region)}, company {n(hintCosts.company)}. The right name
              is never a wrong guess. Earlier wrong names still count. Penalties are subtracted from the base. What is left is the subtotal.
            </span>
          </li>
          <li>
            <strong>3. Tokens</strong>
            <span>
              Multiply the subtotal by {n(config.tokenScale)} divided by the tokens the replies used, and cap that factor at ×{config.tokenCap}.
              Input and output tokens both count. {n(config.tokenScale)} tokens is ×1. {n(capAt)} tokens or fewer, including 0, is ×{config.tokenCap}.
              Going past {n(config.tokenScale)} tokens shrinks the score below ×1, so {n(config.tokenScale * 2)} tokens is ×0.5.
            </span>
          </li>
          <li>
            <strong>4. No-hint mode</strong>
            <span>
              Play without hints and the roster never shrinks and no hint buttons are offered. A round played that way is multiplied by{" "}
              {config.noHintMultiplier}×. Buying a hint means you are in the other mode, so the multiplier stays at 1×.
            </span>
          </li>
          <li>
            <strong>5. Difficulty</strong>
            <span>
              The difficulty you played multiplies the score after the other factors. Easy is {config.difficultyMultipliers.easy}×. Medium is{" "}
              {config.difficultyMultipliers.medium}×. Hard is {config.difficultyMultipliers.hard}×. Impossible is{" "}
              {config.difficultyMultipliers.impossible}×. Easy is the famous models. Medium adds the familiar variants. Hard adds the
              near-duplicates. Impossible is the whole roster. No-hint mode still stacks on top, so an impossible round with no hints is{" "}
              {config.difficultyMultipliers.impossible}× and then {config.noHintMultiplier}×.
            </span>
          </li>
          <li>
            <strong>6. Rounding</strong>
            <span>The result rounds to the nearest whole number, halves up. It never goes below 0.</span>
          </li>
        </ol>
      </div>
      <h2>Hints</h2>
      <p>
        Company, region, year, and size can each be revealed once, after the first reply. A revealed trait is known from then on, and
        the guess list drops models that do not match it. A trait the round already showed you has no hint.
      </p>
      <h2>One round</h2>
      <p>
        The replies used {n(exampleTokens)} tokens, counting input and output. You bought the size hint and named one wrong model before the
        right one. You were not in no-hint mode, because you bought a hint. The round was medium, so the difficulty multiplier is{" "}
        {config.difficultyMultipliers.medium}×.
      </p>
      <pre className="formula">{`base      = ${n(config.modelBase)}                         (named the model)
penalties = ${n(hintCosts.size)} + ${n(config.wrongGuessCost)} = ${n(hintCosts.size + config.wrongGuessCost)}               (size hint, one wrong guess)
subtotal  = ${n(exampleSubtotal)}
factor    = min(${config.tokenCap}, ${n(config.tokenScale)} / ${n(exampleTokens)}) ≈ ${formatFactor(exampleFactor)}
difficulty = ×${config.difficultyMultipliers.medium}                        (medium)
score     = round(${n(exampleSubtotal)} × ${n(config.tokenScale)} / ${n(exampleTokens)} × ${config.difficultyMultipliers.medium})
          = ${n(example.score)}`}</pre>
      <p className="muted">Your own result page lists the lines for that round.</p>
    </div>
  );
}
