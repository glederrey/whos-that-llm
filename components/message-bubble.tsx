"use client";

import { memo, useEffect, useSyncExternalStore } from "react";
import { ModelReply } from "./markdown-message";
import type { LiveText } from "./use-round";

// Memoized: a finished bubble has stable props, so typing in the composer or a
// streamed token elsewhere never re-parses its markdown.
export const MessageBubble = memo(function MessageBubble({
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
});

/** The reply being streamed. It alone re-renders per frame; `onGrow` fires after each paint-batch of new text. */
export function LiveReply({ live, onGrow }: { live: LiveText; onGrow: () => void }) {
  const text = useSyncExternalStore(live.subscribe, live.get, () => null);
  useEffect(() => {
    onGrow();
  }, [text, onGrow]);
  return <MessageBubble role="assistant" content={text ?? ""} live />;
}
