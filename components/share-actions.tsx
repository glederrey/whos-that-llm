"use client";

import { useState } from "react";
import { facebookShareUrl, shareCardPath, shareFileName, sharePageUrl, xShareUrl } from "@/lib/share-card";

/** Download on every screen. A phone shares the PNG. A computer opens X and Facebook. */
export function ShareActions({ gameId, text }: { gameId: string; text: string }) {
  const pageUrl = sharePageUrl(gameId);
  const fileName = shareFileName(gameId);
  const downloadUrl = `${shareCardPath(gameId)}?download=1`;
  const [note, setNote] = useState<string | null>(null);

  async function onShare() {
    setNote(null);
    try {
      const response = await fetch(shareCardPath(gameId));
      if (!response.ok) {
        setNote("The card could not be drawn.");
        return;
      }
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (!navigator.share) {
        setNote("This browser cannot open the share sheet.");
        return;
      }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: pageUrl });
        return;
      }
      await navigator.share({ text, url: pageUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote("The card could not be shared.");
    }
  }

  return (
    <div className="share-actions">
      <a className="button" href={downloadUrl} download={fileName}>
        Download
      </a>
      <span className="share-desktop">
        <a className="button-quiet" href={xShareUrl(pageUrl, text)} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
        <a className="button-quiet" href={facebookShareUrl(pageUrl, text)} target="_blank" rel="noopener noreferrer">
          Share on Facebook
        </a>
      </span>
      <span className="share-phone">
        <button className="button-quiet" type="button" onClick={onShare}>
          Share
        </button>
      </span>
      {note ? <p className="share-note">{note}</p> : null}
    </div>
  );
}
