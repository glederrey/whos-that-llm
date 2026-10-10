"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import type { HintKey, PublicGame } from "@/lib/game";
import { CompanyLogo } from "./company-logo";
import { MarkdownMessage } from "./markdown-message";
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [game.transcript, liveUser, liveAssistant]);

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

  const shown = game.awaitingGuess ? Math.max(game.messageNumber, 1) : Math.min(game.messageLimit, game.messageNumber + 1);
  const inputLocked = busy || game.messageNumber >= game.messageLimit || game.status !== "active";
  const given = new Map(game.given.map((row) => [row.key, row.value]));
  const hintsOpen = game.hintsAllowed && !game.noHint;
  const showBoard = !game.noHint && game.category !== "origin";
  const selectedRow = game.candidates.find((row) => row.id === selected) ?? null;

  function revealGiven(key: "year" | "size") {
    const next = openedHints.includes(key) ? openedHints : [...openedHints, key];
    setOpenedHints(next);
    window.sessionStorage.setItem(`hints:${game.id}`, JSON.stringify(next));
  }

  function hintShown(key: "year" | "size") {
    return Boolean(game.hints[key]) || openedHints.includes(key);
  }

  function purchasable(key: "company" | "region" | "family") {
    const visible =
      given.has(key) ||
      Boolean(game.hints[key]) ||
      (key === "company" && game.feedback?.company === "match") ||
      (key === "region" && game.feedback?.region === "match") ||
      (key === "family" && game.feedback?.familySame);
    if (!hintsOpen || visible || game.status !== "active" || game.messageNumber === 0) return null;
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
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      let gotGame = false;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((item) => item.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as {
            type: string;
            text?: string;
            error?: string;
            paused?: boolean;
            game?: PublicGame;
          };
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
        }
      }
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

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="round">
      <header>
        <div className="meta round-bar">
          <div className="round-title">
            <span>
              <strong>
                Message {shown} of {game.messageLimit}
              </strong>
              <span className="muted"> · {game.poolLabel}</span>
              {game.noHint ? <span className="pill">No hints</span> : null}
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
          <div key={`${message.turn}-${message.role}`} className={`bubble ${message.role}`}>
            {message.role === "assistant" ? <MarkdownMessage text={message.content} /> : message.content}
          </div>
        ))}
        {liveUser !== null ? <div className="bubble user">{liveUser}</div> : null}
        {liveAssistant !== null ? (
          <div className="bubble assistant" aria-live="polite">
            {liveAssistant === "" ? (
              <span className="typing" aria-label="Waiting for the reply">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <MarkdownMessage text={liveAssistant} />
            )}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <textarea
          value={draft}
          placeholder="Ask something"
          maxLength={config.maxUserChars}
          disabled={inputLocked}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="meta">
          <span>
            {draft.length} / {config.maxUserChars}
          </span>
          <button type="button" className="button" disabled={inputLocked || !draft.trim()} onClick={() => void sendMessage()}>
            Send
          </button>
        </div>
        {notice ? <p className="error">{notice}</p> : null}
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
            <TraitLine
              label="Family"
              value={given.get("family") ?? (game.feedback?.familySame ? game.feedback.familyValue : null) ?? game.hints.family}
              reveal={purchasable("family")}
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
        {game.pastGuesses.length > 0 ? (
          <section className="card guess-history">
            <h2>Previous guesses</h2>
            {game.pastGuesses.map((guess) => (
              <div key={guess.id} className={guess.id === freshGuessId ? "past-guess arrive" : "past-guess"}>
                <div className="past-model">
                  <CompanyLogo src={guess.logoPath} />
                  <span>
                    {guess.companyName}
                    <br />
                    {guess.name}
                  </span>
                </div>
                {guess.wrong.length > 0 ? (
                  <p className="wrong-line">{guess.wrong.map((trait) => `Wrong ${trait}`).join(" · ")}</p>
                ) : (
                  <p className="wrong-line">Wrong model</p>
                )}
              </div>
            ))}
          </section>
        ) : null}
        {game.awaitingGuess ? (
          <section className="card stack guess-box">
            <h2>Guess for message {game.messageNumber}.</h2>
            <p className="muted">
              {game.messageNumber < game.messageLimit
                ? "You can guess, or send another message."
                : "Last message. Name the model, or give up."}
            </p>
            <div className="guess-search">
              {selectedRow && !listOpen ? (
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
                      aria-pressed={selected === row.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
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
            <button type="button" className="button" disabled={!selected || guessBusy || busy} onClick={() => void guess()}>
              Submit guess
            </button>
          </section>
        ) : null}
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
