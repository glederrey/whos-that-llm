"use client";

import { useEffect, useState } from "react";

const rounds = [
  { q: "What should I name a cat that loves lasagna?", a: "Lasagnor. It sounds dignified, and it tells the whole house exactly what he is being fed.", who: "Claude" },
  { q: "Explain recursion in one sentence.", a: "Recursion is when a function solves a problem by calling itself on a smaller piece of it, until a simple case stops the chain.", who: "ChatGPT" },
  { q: "Tell me a joke about databases.", a: "Why did the developer leave the database? Too many relationships, and none of them had a foreign key.", who: "Gemini" },
];
const guesses = ["ChatGPT", "Claude", "Gemini", "Llama"];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {}
  }, []);
  return reduced;
}

/** A looping example round: ask, typing, reply, the guess row sweeps, then the reveal. Decoration only. */
export function RevealDemo() {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"ask" | "typing" | "reply" | "guess" | "reveal">("ask");
  const [chars, setChars] = useState(0);
  const [sweep, setSweep] = useState(-1);
  const current = rounds[round];
  const answer = guesses.indexOf(current.who);

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    if (phase === "ask") {
      setChars(0);
      setSweep(-1);
      timer = setTimeout(() => setPhase("typing"), 900);
    } else if (phase === "typing") {
      timer = setTimeout(() => setPhase("reply"), 1100);
    } else if (phase === "reply") {
      tick = setInterval(() => {
        setChars((value) => {
          if (value + 2 >= current.a.length) {
            clearInterval(tick);
            timer = setTimeout(() => setPhase("guess"), 600);
            return current.a.length;
          }
          return value + 2;
        });
      }, 28);
    } else if (phase === "guess") {
      let step = 0;
      tick = setInterval(() => {
        step += 1;
        setSweep(step % guesses.length);
        if (step >= guesses.length + answer + 1) {
          clearInterval(tick);
          setSweep(answer);
          timer = setTimeout(() => setPhase("reveal"), 500);
        }
      }, 320);
    } else {
      timer = setTimeout(() => {
        setRound((value) => (value + 1) % rounds.length);
        setPhase("ask");
      }, 3200);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [phase, reduced, current.a.length, answer]);

  const showReply = reduced || phase === "reply" || phase === "guess" || phase === "reveal";
  const text = reduced ? current.a : current.a.slice(0, chars);
  const showGuess = reduced || phase === "guess" || phase === "reveal";
  const revealed = reduced || phase === "reveal";
  const lit = revealed ? answer : sweep;

  return (
    <div className="card demo" aria-label="An example round" role="img">
      <div className="demo-head">
        <span>Example round</span>
        <span>Message 1 of 10</span>
      </div>
      <div className="demo-chat" aria-hidden="true">
        <div className="bubble user">{current.q}</div>
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
        <span className="demo-prompt">{revealed ? "It was…" : "Who is it?"}</span>
        <div className="demo-picks">
          {guesses.map((name, index) => (
            <span key={name} className="demo-pick" data-lit={lit === index} data-right={revealed && index === answer}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Counts up from 0 to `to` once, on the first paint. */
export function CountUp({ to }: { to: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (reduced) return setValue(to);
    let frame = 0;
    const start = performance.now();
    const run = (now: number) => {
      const t = Math.min((now - start) / 1400, 1);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(run);
    };
    setValue(0);
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [to, reduced]);
  return <>{value.toLocaleString("en-US")}</>;
}
