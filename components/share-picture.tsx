"use client";

import { useLayoutEffect, useState } from "react";
import { shareCardImagePath, type ShareCardTheme } from "@/lib/share-card";
import { shareCardHeight, shareCardWidth } from "@/lib/share-card-image";

function readTheme(): ShareCardTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The public picture. The theme is chosen in the browser, so the first paint waits for it. */
export function SharePicture({ gameId, alt }: { gameId: string; alt: string }) {
  const [theme, setTheme] = useState<ShareCardTheme | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => setTheme(readTheme());
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  if (!theme) {
    return <div className="share-picture share-picture-pending" aria-hidden="true" />;
  }

  return (
    <img
      className="share-picture"
      src={shareCardImagePath(gameId, theme)}
      alt={alt}
      width={shareCardWidth}
      height={shareCardHeight}
    />
  );
}
