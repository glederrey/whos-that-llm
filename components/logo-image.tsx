import { lobeIdOf, lobeThemeUrl } from "@/lib/lobe-logo";

/**
 * A shipped logo is drawn twice, one per theme, and the theme CSS shows the one that fits.
 * With `lazy` the browser skips the image hidden by `display: none`, so only the visible theme downloads.
 */
export function themedLogoUrls(src: string): { light: string; dark: string } | null {
  const match = /^\/lobe\/([a-z0-9-]+)\.svg$/.exec(src);
  const id = match ? lobeIdOf(`lobe:${match[1]}`) : null;
  return id ? { light: lobeThemeUrl(id, "light"), dark: lobeThemeUrl(id, "dark") } : null;
}

export function LogoImage({ src, width, height, lazy }: { src: string; width?: number; height?: number; lazy?: boolean }) {
  const themed = themedLogoUrls(src);
  if (!themed) return <img src={src} alt="" width={width} height={height} loading={lazy ? "lazy" : undefined} />;
  return (
    <>
      <img className="for-light" src={themed.light} alt="" width={width} height={height} loading={lazy ? "lazy" : undefined} />
      <img className="for-dark" src={themed.dark} alt="" width={width} height={height} loading={lazy ? "lazy" : undefined} />
    </>
  );
}
