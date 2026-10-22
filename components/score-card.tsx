"use client";

import type { ReactNode } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { ShareActions } from "@/components/share-actions";
import type { Difficulty } from "@/lib/difficulty";
import { scoreSteps, type ScoreLine } from "@/lib/game";
import { poolSizeLabel } from "@/lib/game-labels";
import { difficultyText } from "@/lib/round-facts";
import { difficultyColor } from "@/lib/share-card";

type ScoreCardModel = {
  name: string;
  logoPath: string;
  facts: string[];
};

/** The result score card. Play again and Leaderboard stay outside it. */
export function ScoreCard({
  model,
  score,
  messages,
  state,
  mode,
  difficulty,
  company = null,
  poolSize = null,
  noHint,
  breakdown,
  share,
  actions,
}: {
  model: ScoreCardModel | null;
  score: number | null;
  messages: number;
  state: "solved" | "miss" | "given_up";
  mode: string;
  difficulty: Difficulty | null;
  /** When set, this name takes the place difficulty occupies. */
  company?: string | null;
  /** Models in the round's pool. Null hides the row. */
  poolSize?: number | null;
  noHint: boolean;
  breakdown: ScoreLine[] | null;
  share: { gameId: string; text: string } | null;
  actions?: ReactNode;
}) {
  const scored = score !== null && breakdown !== null;
  const status =
    state === "solved"
      ? `Solved on message ${messages}.`
      : state === "miss"
        ? "Failed."
        : "Given up.";
  const shown = state === "given_up" ? "given-up" : state;

  return (
    <>
      {model ? (
        <div className="model-lockup">
          <CompanyLogo src={model.logoPath} />
          <div>
            <h1>{model.name}</h1>
            {model.facts.length > 0 ? (
              <div className="model-facts">
                {model.facts.map((fact, index) => (
                  <span key={index} className="pill">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {actions}
      <section className="card score-card">
        <div className="score-head">
          <div>
            <p className="score-label">Your score</p>
            <p className="score">{scored ? score.toLocaleString("en-US") : "—"}</p>
          </div>
          <div className="score-meta">
            <p className="status" data-state={shown}>
              {status}
            </p>
            <dl>
              <dt>Game mode</dt>
              <dd>{mode}</dd>
              {company ? (
                <>
                  <dt>Company</dt>
                  <dd>{company}</dd>
                </>
              ) : (
                <>
                  <dt>Difficulty</dt>
                  <dd style={difficulty ? { color: difficultyColor[difficulty] } : undefined}>{difficultyText(difficulty)}</dd>
                </>
              )}
              {poolSize !== null ? (
                <>
                  <dt>{poolSizeLabel}</dt>
                  <dd>{poolSize.toLocaleString("en-US")}</dd>
                </>
              ) : null}
              {noHint ? (
                <>
                  <dt>Hints</dt>
                  <dd>No hints</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
        {scored ? (
          <table className="breakdown">
            <thead>
              <tr>
                <th></th>
                <th></th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {scoreSteps(breakdown, score).map((step, index) => (
                <tr key={`${step.label}-${index}`} className={step.kind === "subtotal" ? "is-subtotal" : undefined}>
                  <td>{step.label}</td>
                  <td className="change">{step.change}</td>
                  <td>{step.after}</td>
                </tr>
              ))}
              <tr>
                <th>Total</th>
                <th></th>
                <th>{score.toLocaleString("en-US")}</th>
              </tr>
            </tbody>
          </table>
        ) : null}
        <div className="score-foot">
          {share ? <ShareActions gameId={share.gameId} text={share.text} /> : <div />}
          <p className="score-link">
            <a href="/scoring" target="_blank" rel="noopener noreferrer">
              How scoring works
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
