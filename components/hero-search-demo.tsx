"use client";

import { useEffect, useState } from "react";

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
export type SearchDemoTurn = { q: string; a: string };
/** `turns` is one message, or two when the first guess is wrong (`wrongId`) and the player asks again. */
export type SearchDemoRound = { turns: SearchDemoTurn[]; query: string; candidates: SearchDemoModel[]; answerId: string; wrongId?: string };

/** A looping example round that ends in the real guess picker: the query types itself, real models and logos
 *  list below it, one is picked, then it is revealed. Decoration only. */
export function SearchDemo({ rounds }: { rounds: SearchDemoRound[] }) {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<"ask" | "typing" | "reply" | "search" | "pick" | "reveal">("ask");
  const [chars, setChars] = useState(0);
  const [typed, setTyped] = useState(0);
  const current = rounds[round];
  const last = current.turns.length - 1;
  const t = reduced ? last : turn;
  const pickId = t < last && current.wrongId ? current.wrongId : current.answerId;
  const pick = current.candidates.find((model) => model.id === pickId) ?? current.candidates[0];
  const right = pickId === current.answerId;
  const shown = current.turns[t];

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    if (phase === "ask") {
      setChars(0);
      setTyped(0);
      timer = setTimeout(() => setPhase("typing"), 700);
    } else if (phase === "typing") {
      timer = setTimeout(() => setPhase("reply"), 900);
    } else if (phase === "reply") {
      tick = setInterval(() => {
        setChars((value) => {
          if (value + 2 >= shown.a.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase("search"), 500);
            return shown.a.length;
          }
          return value + 2;
        });
      }, 26);
    } else if (phase === "search") {
      tick = setInterval(() => {
        setTyped((value) => {
          if (value + 1 >= current.query.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase("pick"), 900);
            return current.query.length;
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
      }, right ? 3000 : 2600);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [phase, reduced, turn, last, right, shown.a.length, current.query.length, rounds.length]);

  const showReply = reduced || phase === "reply" || phase === "search" || phase === "pick" || phase === "reveal";
  const text = reduced || phase !== "reply" ? shown.a : shown.a.slice(0, chars);
  const showGuess = reduced || phase === "search" || phase === "pick" || phase === "reveal";
  const picked = reduced || phase === "reveal";
  const query = reduced ? "" : current.query.slice(0, typed);
  const listing = !picked && showGuess && typed >= 2;

  return (
    <div className="card demo demo-search" role="img" aria-label="An example round">
      <div className="demo-head" aria-hidden="true">
        <span>Example round</span>
        <span>Message {t + 1} of 10</span>
      </div>
      <div className="demo-chat" aria-hidden="true">
        {current.turns.slice(0, t).map((prev) => (
          <div className="demo-prev" key={prev.q}>
            <div className="bubble user">{prev.q}</div>
            <div className="bubble assistant">{prev.a}</div>
          </div>
        ))}
        <div className="bubble user">{shown.q}</div>
        {phase === "typing" && !reduced ? (
          <div className="bubble assistant">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : null}
        {showReply ? <div className="bubble assistant">{text}</div> : null}
      </div>
      <div className="demo-guess" data-on={showGuess} aria-hidden="true">
        {picked ? (
          <>
            <div className="picked demo-picked" data-right={right}>
              <img src={pick.logoUrl} alt="" width={28} height={28} />
              <span>
                {pick.companyName}
                <br />
                {pick.name}
              </span>
              <b className="demo-it">{right ? `It was ${pick.name.split(" ")[0]}!` : "Not this one"}</b>
            </div>
            {right ? null : <p className="demo-wrong">Wrong guess: −100 points. You can guess again.</p>}
          </>
        ) : (
          <div className="guess-search">
            <div className="demo-input">
              {query ? <span>{query}</span> : <span className="demo-ph">Search models</span>}
              {phase === "search" || phase === "pick" ? <i className="demo-caret" /> : null}
            </div>
            <div className="candidates demo-list" data-on={listing}>
              {current.candidates.map((model) => (
                <div key={model.id} className="candidate demo-cand" data-hot={phase === "pick" && model.id === pickId}>
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
        )}
      </div>
    </div>
  );
}
