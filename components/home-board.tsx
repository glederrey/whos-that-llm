"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { canStartMode, presentDailyCard } from "@/lib/daily";
import { difficulties, difficultyBlurb, difficultyLabel, type Difficulty } from "@/lib/difficulty";
import {
  difficultyAside,
  difficultyBlocked,
  modeToOpen,
  openCompanyOn,
  openGameOn,
  unfinishedLine,
  type OpenGame,
} from "@/lib/lobby-row";

export type HomeGameMode = {
  id: string;
  name: string;
  blurb: string;
  enabled: boolean;
};

const order = ["daily", "all", "company", "class", "region", "custom"];
const hidden = new Set(["latest", "origin", "family"]);

const numberWords = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
  "Twenty",
];

export function capSentence(cap: number): string {
  const count = numberWords[cap] ?? String(cap);
  return `${count} ${cap === 1 ? "game" : "games"} an hour. One more, and the developer goes broke.`;
}

export function lineup(gameModes: HomeGameMode[]): HomeGameMode[] {
  const byId = new Map(gameModes.filter((gameMode) => !hidden.has(gameMode.id)).map((gameMode) => [gameMode.id, gameMode]));
  if (!byId.has("class")) {
    byId.set("class", {
      id: "class",
      name: "Category",
      blurb: "A set we define, not a lab's line. Only Opus, only the nano models, or obscure ones.",
      enabled: false,
    });
  }
  if (!byId.has("custom")) {
    byId.set("custom", {
      id: "custom",
      name: "Custom",
      blurb: "A custom choice of models.",
      enabled: false,
    });
  }
  const known = order.flatMap((id) => {
    const gameMode = byId.get(id);
    return gameMode ? [gameMode] : [];
  });
  const rest = [...byId.values()].filter((gameMode) => !order.includes(gameMode.id));
  return [...known, ...rest].map((gameMode) => presentDailyCard(gameMode));
}

export function HomeBoard({
  paused,
  played,
  cap,
  openGames,
  dailyFinished,
  poolSize,
  difficultyCounts,
  companies,
  nextAt,
  gameModes,
}: {
  paused: boolean;
  played: number;
  cap: number;
  openGames: OpenGame[];
  dailyFinished: Difficulty[];
  poolSize: number;
  difficultyCounts: Record<Difficulty, number>;
  companies: Array<{ id: string; name: string; logoUrl: string; models: number }>;
  nextAt: string | null;
  gameModes: HomeGameMode[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(() => modeToOpen(openGames));
  const [noHint, setNoHint] = useState(false);
  const [notice, setNotice] = useState("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cards = lineup(gameModes);
  const left = Math.max(0, cap - played);
  const full = played >= cap;

  function localTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function slotLabel() {
    if (paused || !nextAt || played === 0) return null;
    const when = localTime(nextAt);
    return left === 0 ? `Next one at ${when}` : `Adding a new game to the pool at ${when}`;
  }

  async function start(gameMode: string, difficulty: Difficulty) {
    const open = openGameOn(openGames, gameMode, difficulty);
    if (open) {
      router.push(`/play/${open.id}`);
      return;
    }
    setBusy(true);
    setNotice("");
    setResumeId(null);
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMode, noHint, difficulty }),
    });
    const body = (await response.json().catch(() => ({}))) as { gameId?: string; error?: string; nextAt?: string };
    setBusy(false);
    if (response.status === 401) {
      router.push("/login?next=/play");
      return;
    }
    if (body.error === "active_game") {
      const known = openGameOn(openGames, gameMode, difficulty) ?? openGames.find((game) => game.id) ?? null;
      setResumeId(body.gameId ?? known?.id ?? null);
      setNotice("You already have a game open.");
      return;
    }
    if (body.gameId) {
      router.push(`/play/${body.gameId}`);
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
    if (body.error === "daily_done") {
      setNotice("You already played that difficulty today.");
      return;
    }
    if (body.error === "not_found") {
      setNotice("That mode is not open yet.");
      return;
    }
    if (body.error === "difficulty") {
      setNotice("Choose a difficulty.");
      return;
    }
    if (body.error === "company") {
      setNotice("Choose a company.");
      return;
    }
    setNotice("Not enough models.");
  }

  async function startCompany(companyId: string) {
    const open = openCompanyOn(openGames, companyId);
    if (open) {
      router.push(`/play/${open.id}`);
      return;
    }
    setBusy(true);
    setNotice("");
    setResumeId(null);
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMode: "company", companyId }),
    });
    const body = (await response.json().catch(() => ({}))) as { gameId?: string; error?: string; nextAt?: string };
    setBusy(false);
    if (response.status === 401) {
      router.push("/login?next=/play");
      return;
    }
    if (body.error === "active_game") {
      const known = openCompanyOn(openGames, companyId);
      setResumeId(body.gameId ?? known?.id ?? null);
      setNotice("You already have a game open.");
      return;
    }
    if (body.gameId) {
      router.push(`/play/${body.gameId}`);
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
      setNotice("That mode is not open yet.");
      return;
    }
    if (body.error === "company") {
      setNotice("Choose a company.");
      return;
    }
    setNotice("Not enough models.");
  }

  const slot = slotLabel();
  const leftLabel = paused ? null : left === 0 ? "None left" : left === 1 ? "1 game left" : `${left} games left`;

  return (
    <div className="stack">
      <h1 className="goal">Game modes</h1>
      <p className="lede">
        One LLM, 10 messages. Guess which one it is, and earn a place on the leaderboard.
      </p>
      <p className="hour-status">
        <strong>{paused ? "The game is paused." : leftLabel}</strong>
        {slot ? <span>{slot}</span> : null}
        {paused ? null : <span className="hour-note">{capSentence(cap)}</span>}
      </p>
      <div className="card category-list">
        {cards.map((gameMode) => {
          const playable = canStartMode(gameMode.id) && gameMode.enabled;
          const daily = gameMode.id === "daily";
          const opened = gameMode.enabled && openId === gameMode.id;
          const custom = gameMode.id === "custom";
          const label = (
            <span>
              <strong>{gameMode.name}</strong>
              <br />
              <span className="muted">{gameMode.blurb}</span>
              {playable && poolSize < 2 ? (
                <>
                  <br />
                  <span className="muted">Not enough models.</span>
                </>
              ) : null}
            </span>
          );
          return (
            <div key={gameMode.id} className={gameMode.enabled ? "category-block" : "category-block closed"}>
              <div className="category-main">
                {gameMode.enabled ? (
                  <button
                    type="button"
                    className="category-toggle"
                    aria-expanded={opened}
                    onClick={() => setOpenId(opened ? null : gameMode.id)}
                  >
                    {label}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <div className="category-toggle">{label}</div>
                )}
                {gameMode.enabled ? null : <span className="pill">Coming soon</span>}
              </div>
              {opened ? (
                <div className="difficulty-panel">
                  {custom ? (
                    <p className="muted">The player chooses that pool.</p>
                  ) : gameMode.id === "company" ? (
                    <>
                      <p className="difficulty-heading">Choose company</p>
                      <div className="difficulty-list">
                        {companies.map((company) => {
                          const count = company.models;
                          const small = count < 2;
                          const open = openCompanyOn(openGames, company.id);
                          const blocked = difficultyBlocked({
                            open: Boolean(open),
                            finished: false,
                            playable,
                            paused,
                            busy,
                            full,
                            count,
                          });
                          const choice = (
                            <>
                              <CompanyLogo src={company.logoUrl} />
                              <span className="difficulty-name">
                                <strong>{company.name}</strong>
                                {playable && small && !open ? <span className="muted">Not enough models.</span> : null}
                              </span>
                              {open ? (
                                <span className="difficulty-resume">{unfinishedLine}</span>
                              ) : (
                                <span className="difficulty-count">{difficultyAside(count, false)}</span>
                              )}
                            </>
                          );
                          return playable ? (
                            <button
                              key={company.id}
                              type="button"
                              className="difficulty-choice company-choice"
                              disabled={blocked}
                              onClick={() => void startCompany(company.id)}
                            >
                              {choice}
                            </button>
                          ) : (
                            <div key={company.id} className="difficulty-choice company-choice is-soon">
                              {choice}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="difficulty-heading">Choose difficulty</p>
                      <div className="difficulty-list">
                        {difficulties.map((difficulty) => {
                          const count = difficultyCounts[difficulty];
                          const small = count < 2;
                          const finished = daily && dailyFinished.includes(difficulty);
                          const open = openGameOn(openGames, gameMode.id, difficulty);
                          const blocked = difficultyBlocked({
                            open: Boolean(open),
                            finished,
                            playable,
                            paused,
                            busy,
                            full,
                            count,
                          });
                          const choice = (
                            <>
                              <span className="difficulty-name">
                                <strong>{difficultyLabel[difficulty]}</strong>
                                <span className="muted">
                                  {difficultyBlurb[difficulty]}
                                  {playable && small && !open ? ". Not enough models." : ""}
                                  {finished ? ". Already played." : ""}
                                </span>
                              </span>
                              {open ? (
                                <span className="difficulty-resume">{unfinishedLine}</span>
                              ) : (
                                <span className="difficulty-count">{difficultyAside(count, false)}</span>
                              )}
                            </>
                          );
                          return playable ? (
                            <button
                              key={difficulty}
                              type="button"
                              className={`difficulty-choice difficulty-${difficulty}${finished ? " is-done" : ""}`}
                              disabled={blocked}
                              title={finished ? "Already played today." : undefined}
                              onClick={() => void start(gameMode.id, difficulty)}
                            >
                              {choice}
                            </button>
                          ) : (
                            <div key={difficulty} className={`difficulty-choice difficulty-${difficulty} is-soon`}>
                              {choice}
                            </div>
                          );
                        })}
                      </div>
                      {playable ? (
                        <label className="check category-check">
                          <input type="checkbox" checked={noHint} onChange={(event) => setNoHint(event.target.checked)} />
                          <span>
                            <strong>Play without hints.</strong>
                            <span className="muted">No hints. No match feedback.</span>
                          </span>
                        </label>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {notice ? (
        <p className="error">
          {notice}{" "}
          {notice.startsWith("You already have a game open") && resumeId ? (
            <a href={`/play/${resumeId}`}>Continue</a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
