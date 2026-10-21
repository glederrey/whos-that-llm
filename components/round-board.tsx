"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { config } from "@/lib/config";
import { upcomingMessageNumber, type PublicGame } from "@/lib/game";
import { filterCandidates } from "@/lib/round-view";
import { ChatComposer } from "./chat-composer";
import { CompanyLogo } from "./company-logo";
import { GuessHistory } from "./guess-history";
import { MessageBubble } from "./message-bubble";
import { TraitLine } from "./trait-line";
import { useGuessFit } from "./use-guess-fit";
import { useRound } from "./use-round";

export function RoundBoard({ initial }: { initial: PublicGame }) {
  const [listOpen, setListOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blurTimer = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const roundRef = useRef<HTMLDivElement>(null);
  const {
    game,
    draft,
    setDraft,
    busy,
    liveUser,
    liveAssistant,
    notice,
    search,
    setSearch,
    selected,
    setSelected,
    guessBusy,
    hintBusy,
    openedHints,
    freshGuessId,
    inputLocked,
    revealGiven,
    sendMessage,
    guess,
    buy,
    giveUp,
  } = useRound(initial, {
    closeList: () => setListOpen(false),
    closeDialog: () => dialogRef.current?.close(),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [game.transcript, liveUser, liveAssistant]);

  useGuessFit(roundRef);

  const shown = upcomingMessageNumber(game.messageNumber, game.messageLimit);
  const canGuess = game.awaitingGuess && game.status === "active";
  const guessFor = Math.max(game.messageNumber, 1);
  const given = new Map(game.given.map((row) => [row.key, row.value]));
  const hintsOpen = game.hintsAllowed && !game.noHint;
  const showBoard = !game.noHint && game.gameMode !== "origin";
  const selectedRow = game.candidates.find((row) => row.id === selected) ?? null;

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

  const rows = useMemo(() => filterCandidates(game.candidates, search), [game.candidates, search]);

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
              <GuessHistory pastGuesses={game.pastGuesses} noHint={game.noHint} freshGuessId={freshGuessId} />
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
