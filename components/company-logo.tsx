"use client";

import { useState } from "react";

export function CompanyLogo({ src }: { src: string }) {
  const [shown, setShown] = useState<string | null>(null);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      hidden={shown !== src}
      onLoad={() => setShown(src)}
      onError={() => setShown((current) => (current === src ? null : current))}
    />
  );
}
