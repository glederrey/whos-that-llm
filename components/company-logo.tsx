"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { LogoImage, themedLogoUrls } from "./logo-image";

// `lazy` is for lists and menus: the hidden theme variant of a shipped logo is then never downloaded.
export function CompanyLogo({ src, lazy }: { src: string; lazy?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useLayoutEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setShown(src);
  }, [src]);

  if (!src) return null;
  if (themedLogoUrls(src)) return <LogoImage src={src} lazy={lazy} />;
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
