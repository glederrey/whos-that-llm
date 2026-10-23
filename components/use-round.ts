"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { HintKey, PublicGame } from "@/lib/game";
import { readReplyEvents } from "@/lib/reply-events";
import { REPLY_FAILED, parseOpenedHints, replyFailureNotice, withOpenedHint, type OpenableHint } from "@/lib/round-view";

// Round state and every request a round makes: send a message (SSE), guess,
// buy a hint, give up. The component keeps only what touches the DOM.
export function useRound(initial: PublicGame, { closeList, closeDialog }: { closeList: () => void; closeDialog: () => void }) {
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
  const [openedHints, setOpenedHints] = useState<OpenableHint[]>([]);
  const [freshGuessId, setFreshGuessId] = useState<string | null>(null);

  useEffect(() => {
    if (game.awaitingGuess) return;
    setSelected(null);
  }, [game.awaitingGuess]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`hints:${game.id}`);
    if (!raw) return;
    setOpenedHints(parseOpenedHints(raw));
  }, [game.id]);

  const inputLocked = busy || game.messageNumber >= game.messageLimit || game.status !== "active";

  function revealGiven(key: OpenableHint) {
    const next = withOpenedHint(openedHints, key);
    setOpenedHints(next);
    window.sessionStorage.setItem(`hints:${game.id}`, JSON.stringify(next));
  }

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
        setNotice(replyFailureNotice(body.paused || body.error === "paused"));
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
          setNotice(replyFailureNotice(event.paused));
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
      setNotice(REPLY_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function guess() {
    if (!selected || guessBusy) return;
    const guessedId = selected;
    setGuessBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/games/${game.id}/guesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(game.gameMode === "origin" ? { origin: selected } : { modelId: selected }),
      });
      if (response.status === 401) {
        login();
        return;
      }
      const body = await readJson(response);
      if (!response.ok) {
        setNotice(game.gameMode === "origin" ? "That guess did not go through." : "That model is not in the list.");
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
      closeList();
    } catch {
      setNotice(REPLY_FAILED);
    } finally {
      setGuessBusy(false);
    }
  }

  async function buy(key: HintKey) {
    setHintBusy(key);
    setNotice("");
    try {
      const response = await fetch(`/api/games/${game.id}/hints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
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
    } catch {
      setNotice(REPLY_FAILED);
    } finally {
      setHintBusy(null);
    }
  }

  async function giveUp() {
    closeDialog();
    try {
      const response = await fetch(`/api/games/${game.id}/give-up`, { method: "POST" });
      if (response.status === 401) {
        login();
        return;
      }
      if (!response.ok) {
        setNotice(REPLY_FAILED);
        return;
      }
      router.push(`/play/${game.id}/result`);
      router.refresh();
    } catch {
      setNotice(REPLY_FAILED);
    }
  }

  return {
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
  };
}
