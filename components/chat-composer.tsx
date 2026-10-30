"use client";

import { useLayoutEffect, useRef } from "react";

export function ChatComposer({
  draft,
  onDraft,
  onSend,
  disabled,
  limit,
  notice,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  limit?: number;
  notice?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const field = element;

    function fit() {
      field.style.overflowY = "hidden";
      field.style.height = "auto";
      const next = field.scrollHeight;
      const max = Number.parseFloat(getComputedStyle(field).maxHeight);
      const capped = Number.isFinite(max) && next > max;
      field.style.height = `${capped ? max : next}px`;
      field.style.overflowY = capped ? "auto" : "hidden";
    }

    fit();
    const parent = element.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    let width = parent.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = parent.getBoundingClientRect().width;
      if (next === width) return;
      width = next;
      fit();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [draft]);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="composer">
      <textarea
        ref={box}
        rows={1}
        value={draft}
        placeholder="Ask something"
        aria-label="Message"
        maxLength={limit}
        disabled={disabled}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="meta">
        <span>{limit !== undefined ? `${draft.length} / ${limit}` : ""}</span>
        <button type="button" className="button" disabled={disabled || !draft.trim()} onClick={onSend}>
          Send
        </button>
      </div>
      {notice ? <p className="error">{notice}</p> : null}
    </div>
  );
}
