"use client";

import ReactMarkdown from "react-markdown";
import { isEmptyModelReply } from "@/lib/empty-reply";

const safeUrl = /^(https?:|mailto:)/i;

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        skipHtml
        urlTransform={(url) => (safeUrl.test(url.trim()) ? url.trim() : "")}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function ModelReply({ text }: { text: string }) {
  if (isEmptyModelReply(text)) return <span className="empty-message">Empty message</span>;
  return <MarkdownMessage text={text} />;
}
