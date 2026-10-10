"use client";

import ReactMarkdown from "react-markdown";

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
