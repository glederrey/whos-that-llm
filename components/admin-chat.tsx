"use client";

import { useEffect, useRef, useState } from "react";
import { transcriptForCall } from "@/lib/admin-chat";
import { readReplyEvents } from "@/lib/reply-events";
import { replyTokenLines } from "@/lib/reply-tokens";
import { ChatComposer } from "./chat-composer";
import { MessageBubble } from "./message-bubble";
import { ReplyTokenTip } from "./reply-token-tip";

export type ChatModelChoice = {
  id: string;
  name: string;
  companyName: string;
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
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function AdminChat({ models }: { models: ChatModelChoice[] }) {
  const [modelId, setModelId] = useState("");
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
          commit({ content: event.message || "The reply failed.", failed: true });
        }
        if (event.type === "done") {
          finished = true;
          commit({
            content: typeof event.text === "string" ? event.text : "",
            promptTokens: count(event.promptTokens),
            completionTokens: count(event.completionTokens),
            reasoningTokens: count(event.reasoningTokens),
            cacheReadTokens: count(event.cacheReadTokens),
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

  return (
    <>
      <div className="chat-toolbar">
        <label className="chat-model">
          Model
          <select value={modelId} disabled={busy} onChange={(event) => { setModelId(event.target.value); resetThread(); }}>
            <option value="">Choose a model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} · {model.companyName}
                {model.enabled ? "" : " (off)"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button-quiet" onClick={resetThread} disabled={busy || messages.length === 0}>
          Clear
        </button>
      </div>
      <div className="transcript">
        {messages.map((message) => {
          if (message.role === "assistant" && message.promptTokens !== undefined && views[viewIndex]) {
            const tokens = views[viewIndex];
            viewIndex += 1;
            return (
              <ReplyTokenTip key={message.id} tokens={tokens}>
                <MessageBubble role="assistant" content={message.content} />
              </ReplyTokenTip>
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
