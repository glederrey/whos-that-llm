import sharp from "sharp";
import { lobeIdOf, lobeSvgForTheme } from "./lobe-logo";
import { readLobeSvg } from "./lobe-logo-files";
import { logoPublicUrl, readLogo } from "./logos";
import { publicEnv } from "./supabase/env";

const maxLogoBytes = 1024 * 1024;

/** The company mark for the card, as a PNG data URL. A missing file leaves the name on its own. */
export async function readModelLogo(path: string | null, theme: "light" | "dark" = "light"): Promise<string | null> {
  if (!path) return null;
  const lobe = lobeIdOf(path);
  if (lobe) return readLobeCardLogo(lobe, theme);
  const url = /^https?:\/\//i.test(path) ? path : publicLogo(path);
  if (!url || !ownStorage(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxLogoBytes) return null;
    const parsed = readLogo(bytes);
    if (!parsed || parsed.ext !== "png") return null;
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

/** The card only fetches from the project's own Supabase host, so an odd stored URL cannot make the server call elsewhere. */
function ownStorage(url: string): boolean {
  const base = publicEnv()?.url;
  if (!base) return false;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function publicLogo(path: string): string | null {
  const base = publicEnv()?.url;
  if (!base) return null;
  return logoPublicUrl(base, path);
}

/** A shipped logo as a PNG data URL. Mono icons take the card's text colour. */
async function readLobeCardLogo(id: string, theme: "light" | "dark"): Promise<string | null> {
  const svg = await readLobeSvg(id);
  if (!svg) return null;
  const colored = lobeSvgForTheme(svg, theme);
  try {
    const png = await sharp(Buffer.from(colored), { density: 384 }).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
