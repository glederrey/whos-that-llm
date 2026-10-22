"use client";

import { useState } from "react";
import { twemojiUrl } from "@/lib/twemoji";

// An emoji as the same Twemoji picture on every OS (Windows has no flag glyphs).
// Sized by the font size around it. If the picture fails, the text glyph shows.
export function Twemoji({ emoji }: { emoji: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === emoji) return <>{emoji}</>;
  return <img className="twemoji" src={twemojiUrl(emoji)} alt={emoji} loading="lazy" onError={() => setFailed(emoji)} />;
}
