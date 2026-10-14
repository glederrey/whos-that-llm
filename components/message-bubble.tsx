"use client";

import { ModelReply } from "./markdown-message";

export function MessageBubble({
  role,
  content,
  live = false,
}: {
  role: "user" | "assistant";
  content: string;
  live?: boolean;
}) {
  const waiting = live && role === "assistant" && content === "";
  return (
    <div className={`bubble ${role}`} aria-live={live ? "polite" : undefined}>
      {waiting ? (
        <span className="typing" aria-label="Waiting for the reply">
          <i />
          <i />
          <i />
        </span>
      ) : role === "assistant" ? (
        <ModelReply text={content} />
      ) : (
        content
      )}
    </div>
  );
}
