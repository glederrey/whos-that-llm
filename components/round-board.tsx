"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { upcomingMessageNumber, type HintKey, type PublicGame } from "@/lib/game";
import { readReplyEvents } from "@/lib/reply-events";
import { ChatComposer } from "./chat-composer";
import { CompanyLogo } from "./company-logo";
import { MessageBubble } from "./message-bubble";
import { RegionFlag } from "./region-flag";

export function RoundBoard({ initial }: { initial: PublicGame }) {
  const router = useRouter();
  const [game, setGame] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveUser, setLiveUser] = useState<string | null>(null);
  const [liveAssistant, setLiveAssistant] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [guessBusy, setGuessBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState<HintKey | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [openedHints, setOpenedHints] = useState<Array<"year" | "size">>([]);
  const [freshGuessId, setFreshGuessId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blurTimer = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const roundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [game.transcript, liveUser, liveAssistant]);

  useEffect(() => {
    const round = roundRef.current;
    if (!round) return;
    const gap = 16;
    const stickyTop = 16;
    let frame = 0;
    let applied = "";
    const fit = () => {
      frame = 0;
      const side = round.querySelector<HTMLElement>(".side");
      const thread = round.querySelector<HTMLElement>(".thread");
      const history = side?.querySelector<HTMLElement>(".guess-history");
      if (!side || !thread || !history) return;
      if (window.matchMedia("(max-width: 899px)").matches) {
        history.style.removeProperty("--fit");
        history.style.maxHeight = "";
        applied = "";
        return;
      }
      const composer = thread.querySelector<HTMLElement>(".composer");
      const threadTop = thread.getBoundingClientRect().top;
      const top = Math.max(stickyTop, threadTop);
      const composerBottom = composer?.getBoundingClientRect().bottom ?? thread.getBoundingClientRect().bottom;
      // At the top of the page the card stops just above the window. Once the
      // writing box is on screen, the card ends level with it.
      const limit = Math.min(window.innerHeight - gap, composerBottom);
      const feedback = side.querySelector<HTMLElement>(".feedback");
      const guessBox = side.querySelector<HTMLElement>(".guess-box");
      let used = 0;
      if (feedback) used += feedback.offsetHeight + gap;
      if (guessBox) used += guessBox.offsetHeight + gap;
      const available = Math.max(0, Math.round(limit - top - used));
      const mark = `${available}:${history.childElementCount}`;
      if (mark === applied) return;
      side.style.maxHeight = "none";
      history.style.maxHeight = "none";
      history.style.setProperty("--fit", "1");
      const natural = history.offsetHeight;
      side.style.maxHeight = "";
      if (natural <= available) {
        history.style.maxHeight = "";
        applied = mark;
        return;
      }
      history.style.maxHeight = `${available}px`;
      let low = 0.3;
      let high = 1;
      let best = low;
      for (let step = 0; step < 6; step += 1) {
        const mid = (low + high) / 2;
        history.style.setProperty("--fit", mid.toFixed(3));
        if (history.scrollHeight <= history.clientHeight + 1) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      history.style.setProperty("--fit", best.toFixed(3));
      applied = mark;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    const watched = round.querySelector(".side");
    const thread = round.querySelector(".thread");
    const composer = thread?.querySelector(".composer");
    const feedback = watched?.querySelector(".feedback");
    const guessBox = watched?.querySelector(".guess-box");
    if (thread) observer.observe(thread);
    if (composer) observer.observe(composer);
    if (feedback) observer.observe(feedback);
    if (guessBox) observer.observe(guessBox);
    const mutations = new MutationObserver(() => {
      applied = "";
      schedule();
    });
    if (watched) mutations.observe(watched, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      mutations.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      const history = round.querySelector<HTMLElement>(".guess-history");
      history?.style.removeProperty("--fit");
      if (history) history.style.maxHeight = "";
    };
  }, []);

  useEffect(() => {
    if (game.awaitingGuess) return;
    setSelected(null);
  }, [game.awaitingGuess]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`hints:${game.id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<"year" | "size">;
      setOpenedHints(parsed);
    } catch {
      setOpenedHints([]);
    }
  }, [game.id]);

  const shown = upcomingMessageNumber(game.messageNumber, game.messageLimit);
  const canGuess = game.awaitingGuess && game.status === "active";
  const guessFor = Math.max(game.messageNumber, 1);
  const inputLocked = busy || game.messageNumber >= game.messageLimit || game.status !== "active";
  const given = new Map(game.given.map((row) => [row.key, row.value]));
  const hintsOpen = game.hintsAllowed && !game.noHint;
  const showBoard = !game.noHint && game.gameMode !== "origin";
  const selectedRow = game.candidates.find((row) => row.id === selected) ?? null;

  function revealGiven(key: "year" | "size") {
    const next = openedHints.includes(key) ? openedHints : [...openedHints, key];
    setOpenedHints(next);
    window.sessionStorage.setItem(`hints:${game.id}`, JSON.stringify(next));
  }

  function hintShown(key: "year" | "size") {
    return Boolean(game.hints[key]) || openedHints.includes(key);
  }

  function purchasable(key: "company" | "region") {
    const visible =
      given.has(key) ||
      Boolean(game.hints[key]) ||
      (key === "company" && game.feedback?.company === "match") ||
      (key === "region" && game.feedback?.region === "match");
    if (game.gameMode === "company" || !hintsOpen || visible || game.status !== "active") return null;
    return { label: `Reveal (−${game.hintCosts[key]} pts)`, busy: hintBusy !== null, onOpen: () => void buy(key) };
  }

  function yearSizeReveal(key: "year" | "size") {
    return {
      label: given.has(key) ? "Reveal" : `Reveal (−${game.hintCosts[key]} pts)`,
      busy: hintBusy !== null,
      onOpen: () => (given.has(key) ? revealGiven(key) : void buy(key)),
    };
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return game.candidates.filter((row) => {
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || row.companyName.toLowerCase().includes(query);
    });
  }, [game.candidates, search]);

  function login() {
    router.push(`/login?next=${encodeURIComponent(`/play/${game.id}`)}`);
  }

  async function readJson(response: Response) {
    return (await response.json().catch(() => ({}))) as PublicGame & { error?: string; paused?: boolean };
  }

  async function sendMessage() {
    const text = draft;
    if (!text.trim() || inputLocked) return;
    setNotice("");
    setBusy(true);
    setLiveUser(text.trim());
    setLiveAssistant("");
    setDraft("");
    try {
      const response = await fetch(`/api/games/${game.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.status === 401) {
        login();
        return;
      }
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/event-stream") || !response.body) {
        const body = await readJson(response);
        setDraft(text);
        setLiveUser(null);
        setLiveAssistant(null);
        setNotice(body.paused || body.error === "paused" ? "The game is paused. Try again later." : "The reply failed. Send it again.");
        return;
      }
      let failed = false;
      let gotGame = false;
      await readReplyEvents(response, (event) => {
        if (event.type === "word" && event.text) setLiveAssistant((current) => (current ?? "") + event.text);
        if (event.type === "error") {
          failed = true;
          setDraft(text);
          setLiveUser(null);
          setLiveAssistant(null);
          setNotice(event.paused ? "The game is paused. Try again later." : "The reply failed. Send it again.");
        }
        if (event.type === "game" && event.game) {
          gotGame = true;
          setGame(event.game);
          setLiveUser(null);
          setLiveAssistant(null);
          setSelected(null);
          setSearch("");
        }
      });
      if (!failed && !gotGame) {
        const fresh = await fetch(`/api/games/${game.id}`);
        const next = fresh.ok ? ((await fresh.json()) as PublicGame) : null;
        if (next && next.messageNumber !== game.messageNumber) setGame(next);
        else setDraft(text);
        setLiveUser(null);
        setLiveAssistant(null);
      }
    } catch {
      setDraft(text);
      setLiveUser(null);
      setLiveAssistant(null);
      setNotice("The reply failed. Send it again.");
    } finally {
      setBusy(false);
    }
  }

  async function guess() {
    if (!selected || guessBusy) return;
    const guessedId = selected;
    setGuessBusy(true);
    setNotice("");
    const response = await fetch(`/api/games/${game.id}/guesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: selected }),
    });
    setGuessBusy(false);
    if (response.status === 401) {
      login();
      return;
    }
    const body = await readJson(response);
    if (!response.ok) {
      setNotice("That model is not in the list.");
      return;
    }
    if (body.status && body.status !== "active") {
      router.push(`/play/${game.id}/result`);
      router.refresh();
      return;
    }
    setFreshGuessId(guessedId);
    setGame(body);
    setSelected(null);
    setSearch("");
    setListOpen(false);
  }

  async function buy(key: HintKey) {
    setHintBusy(key);
    setNotice("");
    const response = await fetch(`/api/games/${game.id}/hints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    setHintBusy(null);
    if (response.status === 401) {
      login();
      return;
    }
    const body = await readJson(response);
    if (!response.ok) {
      setNotice("That hint is not available.");
      return;
    }
    setGame(body);
    setSelected(null);
  }

  async function giveUp() {
    dialogRef.current?.close();
    const response = await fetch(`/api/games/${game.id}/give-up`, { method: "POST" });
    if (response.status === 401) {
      login();
      return;
    }
    if (!response.ok) {
      setNotice("The reply failed. Send it again.");
      return;
    }
    router.push(`/play/${game.id}/result`);
    router.refresh();
  }

  return (
    <div className="round" ref={roundRef}>
      <div className="thread">
        <header>
          <div className="meta round-bar">
            <div className="round-title">
              <span className="round-count">
                <strong>
                  Message {shown} of {game.messageLimit}
                </strong>
                <span className="round-pool muted">
                  <span className="round-pool-sep"> · </span>
                  {game.poolLabel}
                  {game.noHint ? <span className="pill">No hints</span> : null}
                </span>
              </span>
              <span className="progress" aria-hidden="true">
                {Array.from({ length: game.messageLimit }, (_, index) => (
                  <i key={index} className={index < game.messageNumber ? "on" : index === game.messageNumber ? "now" : undefined} />
                ))}
              </span>
            </div>
            <button type="button" className="button-quiet give-up" onClick={() => dialogRef.current?.showModal()} disabled={busy}>
              Give up
            </button>
          </div>
        </header>
        <div className="transcript">
          {game.transcript.map((message) => (
            <MessageBubble key={`${message.turn}-${message.role}`} role={message.role} content={message.content} />
          ))}
          {liveUser !== null ? <MessageBubble role="user" content={liveUser} /> : null}
          {liveAssistant !== null ? <MessageBubble role="assistant" content={liveAssistant} live /> : null}
          <div ref={endRef} />
        </div>
        <ChatComposer
          draft={draft}
          onDraft={setDraft}
          onSend={() => void sendMessage()}
          disabled={inputLocked}
          limit={config.maxUserChars}
          notice={notice}
        />
      </div>
      <aside className="side">
        {showBoard ? (
          <section className="card feedback">
            <TraitLine
              label="Company"
              value={given.get("company") ?? (game.feedback?.company === "match" ? game.feedback.companyValue : null) ?? game.hints.company}
              reveal={purchasable("company")}
            />
            <TraitLine
              label="Region"
              value={given.get("region") ?? (game.feedback?.region === "match" ? game.feedback.regionValue : null) ?? game.hints.region}
              flag
              reveal={purchasable("region")}
            />
            {hintsOpen ? (
              <TraitLine
                label="Year"
                value={hintShown("year") ? (game.hints.year ?? given.get("year") ?? null) : null}
                reveal={hintShown("year") ? null : yearSizeReveal("year")}
              />
            ) : null}
            {hintsOpen ? (
              <TraitLine
                label="Size"
                value={hintShown("size") ? (game.hints.size ?? given.get("size") ?? null) : null}
                reveal={hintShown("size") ? null : yearSizeReveal("size")}
              />
            ) : null}
          </section>
        ) : null}
        <div className="guess-sticky">
            <section className="card stack guess-box">
              <h2>Guess for message {guessFor}.</h2>
              <p className="muted">
                {canGuess
                  ? game.messageNumber < game.messageLimit
                    ? "You can guess, or send another message."
                    : "It's your last guess!"
                  : game.messageNumber < 1
                    ? "Send a message before you guess."
                    : "You already guessed for this message."}
              </p>
              <div className="guess-search">
                {canGuess && selectedRow && !listOpen ? (
                  <button type="button" className="picked" onClick={() => setListOpen(true)}>
                    <CompanyLogo src={selectedRow.logoPath} />
                    <span>
                      {selectedRow.companyName}
                      <br />
                      {selectedRow.name}
                    </span>
                  </button>
                ) : (
                  <input
                    value={search}
                    placeholder="Search models"
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={() => {
                      if (blurTimer.current) window.clearTimeout(blurTimer.current);
                      setListOpen(true);
                    }}
                    onBlur={() => {
                      blurTimer.current = window.setTimeout(() => setListOpen(false), 160);
                    }}
                  />
                )}
                {listOpen ? (
                  <div className="candidates">
                    {rows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="candidate"
                        aria-pressed={canGuess && selected === row.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (!canGuess) return;
                          setSelected(row.id);
                          setSearch("");
                          setListOpen(false);
                        }}
                      >
                        <CompanyLogo src={row.logoPath} />
                        <span>
                          {row.companyName}
                          <br />
                          {row.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button type="button" className="button" disabled={!canGuess || !selected || guessBusy || busy} onClick={() => void guess()}>
                Submit guess
              </button>
            </section>
            {game.pastGuesses.length > 0 ? (
              <section className="card guess-history">
                <h2>Previous guesses</h2>
                {game.pastGuesses.map((guess, index) => (
                  <div key={guess.id} className={guess.id === freshGuessId ? "past-guess arrive" : "past-guess"}>
                    <div className="past-model">
                      <CompanyLogo src={guess.logoPath} />
                      <span>
                        {guess.companyName}
                        <br />
                        {guess.name}
                      </span>
                      <span className="past-message">Message {guess.message}</span>
                    </div>
                    {!game.noHint && index === 0 ? (
                      <p className="wrong-line">
                        {guess.wrong.length > 0 ? guess.wrong.map((trait) => `Wrong ${trait}`).join(" · ") : "Wrong model"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}
          </div>
      </aside>
      <dialog ref={dialogRef} className="dialog">
        <p>End the round? You will see the model. This round stays off the leaderboard.</p>
        <div className="row">
          <button type="button" className="button-quiet" onClick={() => dialogRef.current?.close()}>
            Keep playing
          </button>
          <button type="button" className="button-danger" onClick={() => void giveUp()}>
            Give up
          </button>
        </div>
      </dialog>
    </div>
  );
}

function TraitLine({
  label,
  value,
  flag,
  reveal,
}: {
  label: string;
  value: string | null | undefined;
  flag?: boolean;
  reveal?: { label: string; busy: boolean; onOpen: () => void } | null;
}) {
  return (
    <p className={value ? "trait hit" : "trait"}>
      <span>{label}</span>
      <span className="trait-side">
        {value ? (
          <span className="trait-value">
            {flag ? <RegionFlag region={value} /> : null}
            {value}
          </span>
        ) : (
          <span className="pill">Not found yet</span>
        )}
        {reveal && !value ? (
          <button type="button" className="button-quiet reveal" disabled={reveal.busy} onClick={reveal.onOpen}>
            {reveal.label}
          </button>
        ) : null}
      </span>
    </p>
  );
}
