import { Fragment } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { shareCardDisplay, type ShareCard } from "@/lib/share-card";

/** A scored round invites a rematch. A round with no score just invites a game. */
function playLink(card: ShareCard): string {
  return card.score === null ? "Wanna try a round" : "Wanna try to beat this score";
}

/** The public result. The score table, with no chat and no share buttons. */
export function SharedResult({ card }: { card: ShareCard }) {
  const display = shareCardDisplay(card);
  const state = display.outcome === "Solved" ? "solved" : display.outcome === "Not solved" ? "miss" : "given-up";
  const scored = card.score !== null;
  const noHint = display.details.some((detail) => detail.label === "No-hint");

  return (
    <div className="stack share-result">
      {display.modelName ? (
        <div className="model-lockup">
          <CompanyLogo src={card.modelLogoPath ?? ""} />
          <div>
            <h1>{display.modelName}</h1>
            {display.modelFacts.length > 0 ? (
              <div className="model-facts">
                {display.modelFacts.map((fact, index) => (
                  <span key={index} className="pill">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <section className="card score-card">
        <div className="score-head">
          {scored ? (
            <div>
              <p className="score-label">Your score</p>
              <p className="score">{display.score}</p>
            </div>
          ) : (
            <div />
          )}
          <div className="score-meta">
            <p className="status" data-state={state}>
              {display.status}
            </p>
            <dl>
              {display.meta.map((row) => (
                <Fragment key={row.label}>
                  <dt>{row.label}</dt>
                  <dd style={row.color ? { color: row.color } : undefined}>{row.value}</dd>
                </Fragment>
              ))}
              {noHint ? (
                <>
                  <dt>Hints</dt>
                  <dd>No hints</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
        {scored && display.steps.length > 0 ? (
          <table className="breakdown">
            <thead>
              <tr>
                <th></th>
                <th></th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {display.steps.map((step, index) => (
                <tr key={`${step.label}-${index}`} className={step.kind === "subtotal" ? "is-subtotal" : undefined}>
                  <td>{step.label}</td>
                  <td className="change">{step.change}</td>
                  <td>{step.after}</td>
                </tr>
              ))}
              <tr>
                <th>Total</th>
                <th></th>
                <th>{display.score}</th>
              </tr>
            </tbody>
          </table>
        ) : null}
        <div className="score-foot">
          <div />
          <p className="score-link">
            <a href="/scoring">How scoring works</a>
          </p>
        </div>
      </section>
      <p className="share-cta">
        <a className="button button-lg" href="/">
          {playLink(card)}
        </a>
      </p>
    </div>
  );
}
