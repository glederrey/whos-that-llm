"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function CompanyLogo({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useLayoutEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setShown(src);
  }, [src]);

  if (!src) return null;
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      hidden={shown !== src}
      onLoad={() => setShown(src)}
      onError={() => setShown((current) => (current === src ? null : current))}
    />
  );
}
