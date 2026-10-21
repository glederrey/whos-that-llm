"use client";

import { useEffect, useRef, useState } from "react";
import { readSentTurns, searchChatModels, transcriptForCall, type SentTurn } from "@/lib/admin-chat";
import { readReplyEvents } from "@/lib/reply-events";
import { replyTokenLines, replyTokenTooltip, type ReplyTokens } from "@/lib/reply-tokens";
import { ChatComposer } from "./chat-composer";
import { CompanyLogo } from "./company-logo";
import { MessageBubble } from "./message-bubble";

type ChatModelChoice = {
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
  gptTokens?: number;
  provider?: string;
  sent?: SentTurn[];
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function AdminChat({ models }: { models: ChatModelChoice[] }) {
  const [modelId, setModelId] = useState("");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveUser, setLiveUser] = useState<string | null>(null);
  const [liveAssistant, setLiveAssistant] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
              gptTokens: message.gptTokens,
              provider: message.provider,
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
            gptTokens: count(event.gptTokens),
            provider: event.provider?.trim() || undefined,
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
  const shown = searchChatModels(models, query);
  const selected = models.find((model) => model.id === modelId) ?? null;

  function openList() {
    if (busy) return;
    setQuery("");
    setListOpen(true);
  }

  useEffect(() => {
    if (listOpen) searchRef.current?.focus();
  }, [listOpen]);

  function chooseModel(id: string) {
    if (busy) return;
    setQuery("");
    setListOpen(false);
    if (id === modelId) return;
    setModelId(id);
    resetThread();
  }

  return (
    <>
      <div
        className="chat-picker"
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setListOpen(false);
        }}
      >
        <div className="chat-toolbar">
          <form
            className="chat-search"
            onSubmit={(event) => {
              event.preventDefault();
              setListOpen(true);
            }}
          >
            <label className="chat-query">
              Model
              {selected && !listOpen ? (
                <button type="button" className="chat-selected" disabled={busy} onClick={openList}>
                  <CompanyLogo src={selected.logoUrl} />
                  <ModelLabel model={selected} />
                </button>
              ) : (
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search by name or company"
                  aria-label="Search models"
                  aria-expanded={listOpen}
                  aria-controls="chat-model-list"
                  disabled={busy}
                  onClick={() => setListOpen(true)}
                  onFocus={() => setListOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setListOpen(true);
                  }}
                />
              )}
            </label>
          </form>
          <button type="button" className="button-quiet" onClick={resetThread} disabled={busy || messages.length === 0}>
            Clear
          </button>
        </div>
        {listOpen ? (
          <div id="chat-model-list" className="chat-models" role="listbox" aria-label="Roster models">
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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseModel(model.id)}
                >
                  <CompanyLogo src={model.logoUrl} />
                  <ModelLabel model={model} />
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      <div className="transcript">
        {messages.map((message) => {
          if (message.role === "assistant" && message.promptTokens !== undefined && views[viewIndex]) {
            const tokens = views[viewIndex];
            viewIndex += 1;
            return (
              <div key={message.id} className="reply-block">
                <MessageBubble role="assistant" content={message.content} />
                <ReplyDetails tokens={tokens} sent={message.sent} promptTokens={tokens.rawPrompt} />
              </div>
            );
          }
          if (message.role === "assistant" && message.sent) {
            return (
              <div key={message.id} className="reply-block">
                <MessageBubble role="assistant" content={message.content} />
                <ReplyDetails sent={message.sent} />
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

function ReplyDetails({ tokens, sent, promptTokens }: { tokens?: ReplyTokens; sent?: SentTurn[]; promptTokens?: number }) {
  const [tokensOpen, setTokensOpen] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  if (!tokens && !sent?.length) return null;
  return (
    <div className="sent-input">
      <div className="reply-actions">
        {tokens ? (
          <button type="button" className="button-quiet" onClick={() => setTokensOpen((value) => !value)}>
            {tokensOpen ? "Hide tokens" : "Show tokens"}
          </button>
        ) : null}
        {sent?.length ? (
          <button type="button" className="button-quiet" onClick={() => setInputOpen((value) => !value)}>
            {inputOpen ? "Hide input" : "Show input"}
          </button>
        ) : null}
      </div>
      {tokens && tokensOpen ? (
        <div className="token-lines">
          {replyTokenTooltip(tokens).map((line, index) =>
            line ? <p key={line}>{line}</p> : <div key={`gap-${index}`} className="token-gap" />,
          )}
        </div>
      ) : null}
      {sent && inputOpen ? (
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
