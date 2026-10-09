"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Card = { id: string; name: string; blurb: string };

export function Lobby({
  paused,
  played,
  cap,
  activeGameId,
  poolSize,
  nextAt,
  cards,
}: {
  paused: boolean;
  played: number;
  cap: number;
  activeGameId: string | null;
  poolSize: number;
  nextAt: string | null;
  cards: Card[];
}) {
  const router = useRouter();
  const [noHint, setNoHint] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const full = played >= cap;

  function localTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  async function start(category: string) {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, noHint }),
    });
    const body = (await response.json().catch(() => ({}))) as { gameId?: string; error?: string; nextAt?: string };
    setBusy(false);
    if (response.status === 401) {
      router.push("/login?next=/play");
      return;
    }
    if (body.gameId) {
      router.push(`/play/${body.gameId}`);
      return;
    }
    if (body.error === "active_game") {
      setNotice("You already have a game open.");
      return;
    }
    if (body.error === "hourly_cap") {
      const when = body.nextAt ? localTime(body.nextAt) : nextAt ? localTime(nextAt) : "";
      setNotice(when ? `Hourly limit reached. Next game at ${when}.` : "Hourly limit reached.");
      return;
    }
    if (body.error === "paused") {
      setNotice("The game is paused.");
      return;
    }
    if (body.error === "username") {
      router.push("/welcome?next=/play");
      return;
    }
    setNotice("Not enough models.");
  }

  return (
    <div className="stack">
      <h1>5 messages per game</h1>
      {paused ? <p>The game is paused.</p> : null}
      <p className="lede">
        {full && nextAt ? `Next game at ${localTime(nextAt)}.` : `${played} of ${cap} this hour.`}
      </p>
      {activeGameId ? (
        <a className="button" href={`/play/${activeGameId}`}>
          Continue your game.
        </a>
      ) : (
        <div className="lobby-grid">
          {cards.map((card) => {
            const small = card.id === "all" && poolSize < 2;
            const disabled = paused || full || small || busy || card.id !== "all";
            return (
              <article key={card.id} className="card stack">
                <h2>{card.name}</h2>
                <p className="muted">{card.blurb}</p>
                {small ? <p>Not enough models.</p> : null}
                <button type="button" className="button" disabled={disabled} onClick={() => start(card.id)}>
                  Play
                </button>
              </article>
            );
          })}
          <label className="check">
            <input type="checkbox" checked={noHint} onChange={(event) => setNoHint(event.target.checked)} />
            <span>
              Play without hints.
              <span className="muted"> No year or size hints. No match feedback. Score × 1.5.</span>
            </span>
          </label>
        </div>
      )}
      {notice ? (
        <p className="error">
          {notice}{" "}
          {notice.startsWith("You already have a game open") && activeGameId ? (
            <a href={`/play/${activeGameId}`}>Continue</a>
          ) : null}
        </p>
      ) : null}
      <p>
        <a href="/leaderboard">Leaderboard</a>
      </p>
    </div>
  );
}
