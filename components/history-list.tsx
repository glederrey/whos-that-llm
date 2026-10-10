"use client";

import { useState } from "react";
import { CompanyLogo } from "./company-logo";

export type HistoryItem = {
  id: string;
  when: string;
  status: string;
  state: "active" | "solved" | "miss" | "given_up";
  score: string;
  messages: number;
  modelName: string | null;
  companyName: string | null;
  logoPath: string | null;
  companyFound: boolean;
  regionFound: boolean;
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
              <span>{item.when}</span>
              <span>{item.status}</span>
              <span>{item.score}</span>
            </button>
            {open ? (
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
                  <dt>Model</dt>
                  <dd>{item.modelName ?? "Hidden until the round ends."}</dd>
                  <dt>Status</dt>
                  <dd>{item.status}</dd>
                  <dt>Score</dt>
                  <dd>{item.score}</dd>
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
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
