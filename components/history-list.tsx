"use client";

import { useState } from "react";
import type { Difficulty } from "@/lib/difficulty";
import type { ScoreLine } from "@/lib/game";
import { difficultyText } from "@/lib/round-facts";
import { CompanyLogo } from "./company-logo";
import { ScoreCard } from "./score-card";
import { RoundFacts } from "./round-facts";

export type HistoryItem = {
  id: string;
  when: string;
  status: string;
  state: "active" | "solved" | "miss" | "given_up";
  score: string;
  best: boolean;
  messages: number;
  tokens: string;
  modelName: string | null;
  companyName: string | null;
  logoPath: string | null;
  companyFound: boolean;
  regionFound: boolean;
  mode: string;
  difficulty: Difficulty | null;
  noHint: boolean;
  /** The stored score. The closed row uses the formatted `score` string. */
  scoreValue: number | null;
  modelFacts: string[];
  breakdown: ScoreLine[] | null;
  shareText: string | null;
};

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="history">
      {items.map((item) => {
        const open = openId === item.id;
        const panel = `history-${item.id}`;
        return (
          <li key={item.id} className={open ? "open" : undefined}>
            <button
              type="button"
              className="history-row"
              aria-expanded={open}
              aria-controls={panel}
              onClick={() => setOpenId(open ? null : item.id)}
            >
              <span className="history-when">{item.when}</span>
              <HistoryFacts item={item} />
              <span className="history-outcome">
                <span className="history-status" data-state={item.state}>
                  {item.status}
                </span>
                <span className="history-score" data-best={item.best ? "true" : undefined}>
                  {item.score}
                  {item.best ? <span className="history-best-note"> (best score)</span> : null}
                </span>
              </span>
            </button>
            {open ? <HistoryDetail item={item} panel={panel} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function HistoryFacts({ item }: { item: HistoryItem }) {
  return (
    <span className="history-facts">
      <span className="board-chip history-mode">{item.mode}</span>
      {item.difficulty ? (
        <span className={`board-chip difficulty-${item.difficulty}`}>{difficultyText(item.difficulty)}</span>
      ) : null}
      {item.noHint ? <span className="board-chip no-hints">No hints</span> : null}
    </span>
  );
}

export function HistoryDetail({ item, panel }: { item: HistoryItem; panel?: string }) {
  if (item.state !== "active") {
    return (
      <div id={panel} className="history-detail is-score">
        <ScoreCard
          model={
            item.modelName
              ? { name: item.modelName, logoPath: item.logoPath ?? "", facts: item.modelFacts }
              : null
          }
          score={item.scoreValue}
          messages={item.messages}
          state={item.state}
          mode={item.mode}
          difficulty={item.difficulty}
          noHint={item.noHint}
          breakdown={item.breakdown}
          share={item.shareText ? { gameId: item.id, text: item.shareText } : null}
        />
      </div>
    );
  }
  return (
    <div id={panel} className="history-detail">
      {item.logoPath && item.modelName ? (
        <div className="history-model">
          <CompanyLogo src={item.logoPath} />
          <span>
            {item.companyName ? (
              <>
                {item.companyName}
                <br />
              </>
            ) : null}
            {item.modelName}
          </span>
        </div>
      ) : null}
      <dl className="summary-list">
        <dt>Date</dt>
        <dd>{item.when}</dd>
        <RoundFacts mode={item.mode} difficulty={difficultyText(item.difficulty)} />
        {item.noHint ? (
          <>
            <dt>Hints</dt>
            <dd>No hints</dd>
          </>
        ) : null}
        <dt>Model</dt>
        <dd>{item.modelName ?? "Hidden until the round ends."}</dd>
        <dt>Status</dt>
        <dd>{item.status}</dd>
        <dt>Score</dt>
        <dd>
          {item.score}
          {item.best ? " (best score)" : ""}
        </dd>
        <dt>Tokens</dt>
        <dd>{item.tokens}</dd>
        <dt>Messages used</dt>
        <dd>{item.messages}</dd>
        <dt>Company</dt>
        <dd>{item.companyFound ? "Found" : "Not found"}</dd>
        <dt>Region</dt>
        <dd>{item.regionFound ? "Found" : "Not found"}</dd>
      </dl>
      {item.state === "active" ? (
        <p>
          <a href={`/play/${item.id}`}>Continue</a>
        </p>
      ) : null}
    </div>
  );
}
