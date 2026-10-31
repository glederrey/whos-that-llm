"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Twemoji } from "./twemoji";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {}
  }, []);
  return reduced;
}

export type SearchDemoModel = { id: string; name: string; companyName: string; logoUrl: string };
export type SearchDemoHintKey = "company" | "origin" | "year" | "size";
const hintRows: { key: SearchDemoHintKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "origin", label: "Origin" },
  { key: "year", label: "Year" },
  { key: "size", label: "Size" },
];
/** One message and the guess made after it. A round with a wrong first guess has two turns. */
export type SearchDemoTurn = {
  q: string;
  a: string;
  query: string;
  candidates: SearchDemoModel[];
  pickId: string;
  right: boolean;
  /** A hint revealed before this guess. */
  hint?: { key: SearchDemoHintKey; value: string; flag?: string };
};
export type SearchDemoFacts = Record<SearchDemoHintKey, { value: string; flag?: string }>;
/** `facts` describe the hidden model: all of them show once it is found. */
export type SearchDemoRound = { turns: SearchDemoTurn[]; facts: SearchDemoFacts };

/** A looping example round that ends in the real guess picker: the query types itself, real models and logos
 *  list below it, one is picked, then it is revealed. Decoration only. */
export function SearchDemo({ rounds }: { rounds: SearchDemoRound[] }) {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<"ask" | "typing" | "reply" | "hint" | "search" | "pick" | "reveal">("ask");
  const [chars, setChars] = useState(0);
  const [typed, setTyped] = useState(0);
  const [asked, setAsked] = useState(0);
  const [hintOn, setHintOn] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const current = rounds[round];
  const last = current.turns.length - 1;
  const t = reduced ? last : turn;
  const shown = current.turns[t];
  const pick = shown.candidates.find((model) => model.id === shown.pickId) ?? shown.candidates[0];

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    if (phase === "ask") {
      setChars(0);
      setTyped(0);
      setAsked(0);
      setHintOn(false);
      tick = setInterval(() => {
        setAsked((value) => {
          if (value + 2 >= shown.q.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase("typing"), 600);
            return shown.q.length;
          }
          return value + 2;
        });
      }, 30);
    } else if (phase === "typing") {
      timer = setTimeout(() => setPhase("reply"), 900);
    } else if (phase === "reply") {
      tick = setInterval(() => {
        setChars((value) => {
          if (value + 2 >= shown.a.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase(shown.hint ? "hint" : "search"), 500);
            return shown.a.length;
          }
          return value + 2;
        });
      }, 26);
    } else if (phase === "hint") {
      // The hint flashes, shows its value, then waits so the guess list does not cover it.
      const reveal = setTimeout(() => setHintOn(true), 700);
      const next = setTimeout(() => setPhase("search"), 2000);
      return () => {
        clearTimeout(reveal);
        clearTimeout(next);
      };
    } else if (phase === "search") {
      tick = setInterval(() => {
        setTyped((value) => {
          if (value + 1 >= shown.query.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase("pick"), 900);
            return shown.query.length;
          }
          return value + 1;
        });
      }, 170);
    } else if (phase === "pick") {
      timer = setTimeout(() => setPhase("reveal"), 700);
    } else {
      timer = setTimeout(() => {
        if (turn < last) {
          setTurn(turn + 1);
        } else {
          setTurn(0);
          setRound((value) => (value + 1) % rounds.length);
        }
        setPhase("ask");
      }, shown.right ? 3000 : 2400);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [phase, reduced, turn, last, shown.right, shown.a.length, shown.hint, shown.q.length, shown.query.length, rounds.length]);

  const asking = reduced || phase !== "ask" ? shown.q : shown.q.slice(0, asked);
  const showReply = reduced || phase === "reply" || phase === "hint" || phase === "search" || phase === "pick" || phase === "reveal";
  const text = reduced || phase !== "reply" ? shown.a : shown.a.slice(0, chars);
  const picked = reduced || phase === "reveal";
  const query = reduced || picked ? "" : shown.query.slice(0, typed);
  const listing = !picked && typed >= 2;

  // Content stays top-aligned and scrolls up (with the fade) once it no longer fits.
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight + 1);
    if (turn === 0 && phase === "ask" && asked === 0) el.scrollTo({ top: 0, behavior: "auto" });
    else el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [round, turn, phase, asked, chars, reduced]);

  // Hints revealed so far: earlier turns always, this turn once the guess starts.
  const hintsOut = reduced || (phase === "hint" && hintOn) || phase === "search" || phase === "pick" || phase === "reveal";
  const revealed = new Map<SearchDemoHintKey, { value: string; flag?: string }>();
  current.turns.forEach((row, index) => {
    if (row.hint && (index < t || (index === t && hintsOut))) revealed.set(row.hint.key, row.hint);
  });

  if (picked && shown.right) for (const { key } of hintRows) revealed.set(key, current.facts[key]);

  // Guesses made so far, newest first: a wrong one stays and the next guess pushes it down.
  const results = current.turns
    .slice(0, picked ? t + 1 : t)
    .map((row, index) => ({
      turn: row,
      key: `${round}-${index}`,
      pick: row.candidates.find((model) => model.id === row.pickId) ?? row.candidates[0],
    }))
    .reverse();

  return (
    <div className="card demo demo-search" role="img" aria-label="An example round">
      <div className="demo-head" aria-hidden="true">
        <strong>Message {t + 1} of 10</strong>
      </div>
      <div className="demo-chat" ref={chatRef} data-scrolled={overflow} aria-hidden="true">
        {current.turns.slice(0, t + 1).map((row, index) => {
          const now = index === t;
          const question = now ? asking : row.q;
          const dots = now && phase === "typing" && !reduced;
          return (
            <Fragment key={`${round}-${index}`}>
              {question.length > 0 ? (
                <div className="bubble user">
                  {question}
                  {now ? <span className="demo-rest">{row.q.slice(question.length)}</span> : null}
                </div>
              ) : null}
              {dots ? (
                <div className="bubble assistant">
                  <span className="typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              ) : null}
              {!now || showReply ? <div className="bubble assistant">{now ? text || "\u200b" : row.a}</div> : null}
            </Fragment>
          );
        })}
      </div>
      <div className="demo-guess" aria-hidden="true">
        <div className="guess-search">
          <div className="demo-input">
            {query ? <span>{query}</span> : <span className="demo-ph">Search models</span>}
            {phase === "search" || phase === "pick" ? <i className="demo-caret" /> : null}
          </div>
          <div className="candidates demo-list" data-on={listing}>
            {shown.candidates.map((model) => (
              <div key={model.id} className="candidate demo-cand" data-hot={phase === "pick" && model.id === shown.pickId}>
                <img src={model.logoUrl} alt="" width={28} height={28} />
                <span>
                  {model.companyName}
                  <br />
                  {model.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="demo-cols">
          <div className="demo-hints">
            <h3>Hints</h3>
            {hintRows.map(({ key, label }) => {
              const hint = revealed.get(key);
              return (
                <p className="demo-hint" key={key} data-on={Boolean(hint)} data-flash={phase === "hint" && !hintOn && shown.hint?.key === key}>
                  <span>{label}</span>
                  {hint ? (
                    <b>
                      {hint.flag ? <Twemoji emoji={hint.flag} /> : null}
                      {hint.value}
                    </b>
                  ) : (
                    <i>Reveal</i>
                  )}
                </p>
              );
            })}
          </div>
          <div className="demo-results">
            <h3>Guesses</h3>
            {results.map(({ turn: row, pick: model, key }) => (
              <div key={key} className="picked demo-picked" data-right={row.right}>
                <img src={model.logoUrl} alt="" width={24} height={24} />
                <span>{model.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
