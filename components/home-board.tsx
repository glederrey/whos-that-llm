"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type HomeCategory = {
  id: string;
  name: string;
  blurb: string;
  enabled: boolean;
};

const order = ["daily", "all", "company", "family", "region", "custom"];
const hidden = new Set(["latest", "origin"]);

export function lineup(categories: HomeCategory[]): HomeCategory[] {
  const byId = new Map(categories.filter((category) => !hidden.has(category.id)).map((category) => [category.id, category]));
  if (!byId.has("custom")) {
    byId.set("custom", {
      id: "custom",
      name: "Custom",
      blurb: "A custom choice of models.",
      enabled: false,
    });
  }
  const known = order.flatMap((id) => {
    const category = byId.get(id);
    return category ? [category] : [];
  });
  const rest = [...byId.values()].filter((category) => !order.includes(category.id));
  return [...known, ...rest];
}

export function HomeBoard({
  paused,
  played,
  cap,
  activeGameId,
  poolSize,
  nextAt,
  categories,
}: {
  paused: boolean;
  played: number;
  cap: number;
  activeGameId: string | null;
  poolSize: number;
  nextAt: string | null;
  categories: HomeCategory[];
}) {
  const router = useRouter();
  const [noHint, setNoHint] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const cards = lineup(categories);
  const left = Math.max(0, cap - played);
  const full = played >= cap;

  function localTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function slotLabel() {
    if (paused || !nextAt || played === 0) return null;
    const when = localTime(nextAt);
    return left === 0 ? `Next one at ${when}` : `One back at ${when}`;
  }

  async function start(category: string) {
    if (activeGameId && category === "all") {
      router.push(`/play/${activeGameId}`);
      return;
    }
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
    if (body.error === "not_found") {
      setNotice("That category is not open yet.");
      return;
    }
    setNotice("Not enough models.");
  }

  const slot = slotLabel();
  const leftLabel = paused ? null : left === 0 ? "None left" : left === 1 ? "1 game left" : `${left} games left`;

  return (
    <div className="stack">
      <h1 className="goal">Find the model.</h1>
      <p className="lede">
        It answers. You have ten messages to say which one it was.{" "}
        <a href="/scoring">How scoring works</a>
      </p>
      <p className="hour-status">
        <strong>{paused ? "The game is paused." : leftLabel}</strong>
        {slot ? <span>{slot}</span> : null}
        {paused ? null : <span className="muted">{cap} an hour, before the developer goes broke.</span>}
      </p>
      <div className="card category-list">
        {cards.map((category) => {
          const open = category.enabled;
          const small = category.id === "all" && poolSize < 2;
          const continueGame = Boolean(activeGameId) && category.id === "all";
          const disabled = !open || paused || busy || small || (full && !continueGame) || (Boolean(activeGameId) && !continueGame);
          return (
            <div key={category.id} className="category-block">
              <div className="category-main">
                <span>
                  <strong>{category.name}</strong>
                  <br />
                  <span className="muted">{category.blurb}</span>
                  {small ? (
                    <>
                      <br />
                      <span className="muted">Not enough models.</span>
                    </>
                  ) : null}
                </span>
                {open ? (
                  <button type="button" className="button" disabled={!continueGame && disabled} onClick={() => void start(category.id)}>
                    {continueGame ? "Continue" : "Play"}
                  </button>
                ) : (
                  <span className="pill">Not open yet</span>
                )}
              </div>
              {category.id === "all" && open && !continueGame ? (
                <label className="check category-check">
                  <input type="checkbox" checked={noHint} onChange={(event) => setNoHint(event.target.checked)} />
                  <span>
                    <strong>Play without hints.</strong>
                    <span className="muted"> No year or size. No match feedback. Score × 1.5.</span>
                  </span>
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      {notice ? (
        <p className="error">
          {notice}{" "}
          {notice.startsWith("You already have a game open") && activeGameId ? (
            <a href={`/play/${activeGameId}`}>Continue</a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
