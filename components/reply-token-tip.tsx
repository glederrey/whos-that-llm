"use client";

import { useId, useState } from "react";
import { replyTokenTooltip, type ReplyTokens } from "@/lib/reply-tokens";

export function ReplyTokenTip({ tokens, children }: { tokens: ReplyTokens; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tipId = useId();
  const open = hover || pinned;
  const lines = replyTokenTooltip(tokens);

  function toggle(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) return;
    setPinned((value) => !value);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setPinned((value) => !value);
  }

  return (
    <div className="reply-tip" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        className="reply-tip-target"
        onClick={toggle}
        onKeyDown={onKeyDown}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
      >
        {children}
      </div>
      {open ? (
        <div id={tipId} className="reply-tooltip" role="tooltip">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
