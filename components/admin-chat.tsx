"use client";

import { useEffect, useRef, useState } from "react";
import { readSentTurns, searchChatModels, transcriptForCall, type SentTurn } from "@/lib/admin-chat";
import { readReplyEvents } from "@/lib/reply-events";
import { replyTokenLines } from "@/lib/reply-tokens";
import { ChatComposer } from "./chat-composer";
import { CompanyLogo } from "./company-logo";
import { MessageBubble } from "./message-bubble";
import { ReplyTokenTip } from "./reply-token-tip";

export type ChatModelChoice = {
  id: string;
  name: string;
  companyName: string;
  logoUrl: string;
  enabled: boolean;
};

type ThreadMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  sent?: SentTurn[];
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function AdminChat({ models }: { models: ChatModelChoice[] }) {
  const [modelId, setModelId] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveUser, setLiveUser] = useState<string | null>(null);
  const [liveAssistant, setLiveAssistant] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, liveUser, liveAssistant]);

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }

  const views = replyTokenLines(
    messages.flatMap((message) =>
      message.role === "assistant" && message.promptTokens !== undefined && message.completionTokens !== undefined
        ? [
            {
              promptTokens: message.promptTokens,
              completionTokens: message.completionTokens,
              reasoningTokens: message.reasoningTokens ?? 0,
              cacheReadTokens: message.cacheReadTokens ?? 0,
            },
          ]
        : [],
    ),
  );

  function resetThread() {
    setMessages([]);
    setDraft("");
    setLiveUser(null);
    setLiveAssistant(null);
  }

  async function sendMessage() {
    const text = draft;
    const trimmed = text.trim();
    if (!trimmed || busy || !modelId) return;
    const transcript = transcriptForCall(messages);
    setBusy(true);
    setLiveUser(trimmed);
    setLiveAssistant("");
    setDraft("");

    function commit(assistant: Omit<ThreadMessage, "id" | "role"> & { failed?: boolean }) {
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "user", content: trimmed },
        { id: nextId(), role: "assistant", ...assistant },
      ]);
      setLiveUser(null);
      setLiveAssistant(null);
    }

    try {
      const response = await fetch("/admin/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, text, transcript }),
      });
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/event-stream") || !response.body) {
        commit({ content: "The reply failed.", failed: true });
        return;
      }
      let failed = false;
      let finished = false;
      await readReplyEvents(response, (event) => {
        if (event.type === "word" && event.text) setLiveAssistant((current) => (current ?? "") + event.text);
        if (event.type === "error") {
          failed = true;
          commit({ content: event.message || "The reply failed.", failed: true, sent: readSentTurns(event.sent) ?? undefined });
        }
        if (event.type === "done") {
          finished = true;
          commit({
            content: typeof event.text === "string" ? event.text : "",
            promptTokens: count(event.promptTokens),
            completionTokens: count(event.completionTokens),
            reasoningTokens: count(event.reasoningTokens),
            cacheReadTokens: count(event.cacheReadTokens),
            sent: readSentTurns(event.sent) ?? undefined,
          });
        }
      });
      if (!failed && !finished) commit({ content: "The reply failed.", failed: true });
    } catch {
      commit({ content: "The reply failed.", failed: true });
    } finally {
      setBusy(false);
    }
  }

  let viewIndex = 0;
  const shown = searchChatModels(models, applied);
  const selected = models.find((model) => model.id === modelId) ?? null;
  const selectedHidden = selected !== null && !shown.some((model) => model.id === selected.id);

  function chooseModel(id: string) {
    if (busy || id === modelId) return;
    setModelId(id);
    resetThread();
  }

  return (
    <>
      <div className="chat-picker">
        <div className="chat-toolbar">
          <form
            className="chat-search"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(query);
            }}
          >
            <label className="chat-query">
              Model
              <input
                type="search"
                value={query}
                placeholder="Search by name or company"
                aria-label="Search models"
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="button" type="submit" disabled={busy}>
              Search
            </button>
            {applied ? (
              <button
                type="button"
                className="button-quiet"
                disabled={busy}
                onClick={() => {
                  setQuery("");
                  setApplied("");
                }}
              >
                Reset
              </button>
            ) : null}
          </form>
          <button type="button" className="button-quiet" onClick={resetThread} disabled={busy || messages.length === 0}>
            Clear
          </button>
        </div>
        {selectedHidden ? (
          <div className="picked chat-picked">
            <CompanyLogo src={selected.logoUrl} />
            <ModelLabel model={selected} />
          </div>
        ) : null}
        <div className="chat-models" role="listbox" aria-label="Roster models">
          {shown.length === 0 ? (
            <p className="muted">No models match that search.</p>
          ) : (
            shown.map((model) => (
              <button
                key={model.id}
                type="button"
                role="option"
                className="candidate"
                aria-selected={model.id === modelId}
                aria-pressed={model.id === modelId}
                disabled={busy}
                onClick={() => chooseModel(model.id)}
              >
                <CompanyLogo src={model.logoUrl} />
                <ModelLabel model={model} />
              </button>
            ))
          )}
        </div>
      </div>
      <div className="transcript">
        {messages.map((message) => {
          if (message.role === "assistant" && message.promptTokens !== undefined && views[viewIndex]) {
            const tokens = views[viewIndex];
            viewIndex += 1;
            return (
              <div key={message.id} className="reply-block">
                <ReplyTokenTip tokens={tokens}>
                  <MessageBubble role="assistant" content={message.content} />
                </ReplyTokenTip>
                {message.sent ? <SentInput sent={message.sent} promptTokens={tokens.rawPrompt} /> : null}
              </div>
            );
          }
          if (message.role === "assistant" && message.sent) {
            return (
              <div key={message.id} className="reply-block">
                <MessageBubble role="assistant" content={message.content} />
                <SentInput sent={message.sent} />
              </div>
            );
          }
          return <MessageBubble key={message.id} role={message.role} content={message.content} />;
        })}
        {liveUser !== null ? <MessageBubble role="user" content={liveUser} /> : null}
        {liveAssistant !== null ? <MessageBubble role="assistant" content={liveAssistant} live /> : null}
        <div ref={endRef} />
      </div>
      <ChatComposer draft={draft} onDraft={setDraft} onSend={() => void sendMessage()} disabled={busy || !modelId} />
    </>
  );
}

function ModelLabel({ model }: { model: ChatModelChoice }) {
  return (
    <span>
      {model.name}
      <span className="muted">
        {" "}
        · {model.companyName}
        {model.enabled ? "" : " (off)"}
      </span>
    </span>
  );
}

function SentInput({ sent, promptTokens }: { sent: SentTurn[]; promptTokens?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sent-input">
      <button type="button" className="button-quiet" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide input" : "Show input"}
      </button>
      {open ? (
        <div className="sent-body">
          {promptTokens !== undefined ? <p className="muted">Prompt tokens: {promptTokens.toLocaleString("en-US")}</p> : null}
          {sent.map((turn, index) => (
            <section key={`${turn.role}-${index}`} className="sent-turn">
              <p className="sent-role">{turn.role}</p>
              <pre>{turn.content}</pre>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
