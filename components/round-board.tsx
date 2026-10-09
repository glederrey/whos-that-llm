"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import type { PublicGame } from "@/lib/game";

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
  const [hintBusy, setHintBusy] = useState<"year" | "size" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [game.transcript, liveUser, liveAssistant]);

  const shown = game.awaitingGuess ? Math.max(game.messageNumber, 1) : Math.min(game.messageLimit, game.messageNumber + 1);
  const inputLocked = busy || game.awaitingGuess || game.messageNumber >= game.messageLimit || game.status !== "active";
  const givenKeys = new Set(game.given.map((row) => row.key));
  const hintsOpen = game.hintsAllowed && !game.noHint && game.messageNumber >= 1;

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
    setGame(body);
    setSelected(null);
    setSearch("");
  }

  async function buy(key: "year" | "size") {
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
      <header className="stack">
        <div className="meta">
          <strong>
            Message {shown} of {game.messageLimit}
          </strong>
          <span>{game.poolLabel}</span>
        </div>
        <div className="row">
          {game.noHint ? <span className="tag">No hints</span> : null}
          <button type="button" className="button-danger" onClick={() => dialogRef.current?.showModal()} disabled={busy}>
            Give up
          </button>
        </div>
      </header>
      <div className="transcript">
        {game.transcript.map((message) => (
          <div key={`${message.turn}-${message.role}`} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
        {liveUser !== null ? <div className="bubble user">{liveUser}</div> : null}
        {liveAssistant !== null ? (
          <div className="bubble" aria-live="polite">
            {liveAssistant}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="stack">
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
        {game.given.length > 0 ? (
          <section className="card feedback">
            {game.given.map((row) => (
              <p key={row.key} className="known">
                {row.label} · {row.value} <span className="tag">Known</span>
              </p>
            ))}
          </section>
        ) : null}
        {game.feedback ? (
          <section className="card feedback">
            {game.feedback.company === "match" ? <p className="hit">Company · {game.feedback.companyValue}</p> : null}
            {game.feedback.company === "miss" ? <p className="miss">Wrong company</p> : null}
            {game.feedback.region === "match" ? <p className="hit">Region · {game.feedback.regionValue}</p> : null}
            {game.feedback.region === "miss" ? <p className="miss">Wrong region</p> : null}
            {game.feedback.familySame ? <p className="hit">Same family.</p> : null}
          </section>
        ) : null}
        {hintsOpen ? (
          <section className="card stack">
            {!givenKeys.has("year") ? (
              game.hints.year ? (
                <p>Year · {game.hints.year}</p>
              ) : (
                <button type="button" className="button-quiet" disabled={hintBusy !== null} onClick={() => void buy("year")}>
                  Year · {game.hintCost} points
                </button>
              )
            ) : null}
            {!givenKeys.has("size") ? (
              game.hints.size ? (
                <p>Size · {game.hints.size}</p>
              ) : (
                <button type="button" className="button-quiet" disabled={hintBusy !== null} onClick={() => void buy("size")}>
                  Size · {game.hintCost} points
                </button>
              )
            ) : null}
          </section>
        ) : null}
        {game.awaitingGuess ? (
          <section className="card stack">
            <h2>Guess for message {game.messageNumber}.</h2>
            <input value={search} placeholder="Search models" onChange={(event) => setSearch(event.target.value)} />
            <div className="candidates">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="candidate"
                  aria-pressed={selected === row.id}
                  onClick={() => setSelected(row.id)}
                >
                  <img src={row.logoPath} alt="" />
                  <span>
                    {row.companyName}
                    <br />
                    {row.name}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="button" disabled={!selected || guessBusy} onClick={() => void guess()}>
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
