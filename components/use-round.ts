"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { HintKey, PublicGame } from "@/lib/game";
import { readReplyEvents } from "@/lib/reply-events";
import { REPLY_FAILED, replyFailureNotice } from "@/lib/round-view";

// The reply being streamed lives outside React state: RoundBoard does not
// re-render per token. Words are batched and published at most once per frame,
// and only the live bubble subscribes (useSyncExternalStore in LiveReply).
export function createLiveText() {
  let text: string | null = null;
  let pending = "";
  let frame = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  function flush() {
    frame = 0;
    if (text === null || !pending) return;
    text += pending;
    pending = "";
    emit();
  }
  return {
    get: () => text,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start() {
      text = "";
      pending = "";
      emit();
    },
    append(more: string) {
      if (text === null) return;
      pending += more;
      if (!frame) frame = window.requestAnimationFrame(flush);
    },
    clear() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      pending = "";
      if (text === null) return;
      text = null;
      emit();
    },
  };
}

export type LiveText = ReturnType<typeof createLiveText>;

// Round state and every request a round makes: send a message (SSE), guess,
// buy a hint, give up. The component keeps only what touches the DOM.
export function useRound(initial: PublicGame, { closeList, closeDialog }: { closeList: () => void; closeDialog: () => void }) {
  const router = useRouter();
  const [game, setGame] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveUser, setLiveUser] = useState<string | null>(null);
  // liveUser and the live reply start and end together, so liveUser !== null means a reply is streaming.
  const live = useMemo(createLiveText, []);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [guessBusy, setGuessBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState<HintKey | null>(null);
  const [freshGuessId, setFreshGuessId] = useState<string | null>(null);

  useEffect(() => () => live.clear(), [live]);

  useEffect(() => {
    if (game.awaitingGuess) return;
    setSelected(null);
  }, [game.awaitingGuess]);

  const inputLocked = busy || game.messageNumber >= game.messageLimit || game.status !== "active";

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
    live.start();
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
        live.clear();
        setNotice(replyFailureNotice(body.paused || body.error === "paused"));
        return;
      }
      let failed = false;
      let gotGame = false;
      await readReplyEvents(response, (event) => {
        if (event.type === "word" && event.text) live.append(event.text);
        if (event.type === "error") {
          failed = true;
          setDraft(text);
          setLiveUser(null);
          live.clear();
          setNotice(replyFailureNotice(event.paused));
        }
        if (event.type === "game" && event.game) {
          gotGame = true;
          setGame(event.game);
          setLiveUser(null);
          live.clear();
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
        live.clear();
      }
    } catch {
      setDraft(text);
      setLiveUser(null);
      live.clear();
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
    live,
    notice,
    search,
    setSearch,
    selected,
    setSelected,
    guessBusy,
    hintBusy,
    freshGuessId,
    inputLocked,
    sendMessage,
    guess,
    buy,
    giveUp,
  };
}
