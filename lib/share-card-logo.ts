import { logoPublicUrl, readLogo } from "./logos";
import { publicEnv } from "./supabase/env";

/** The company mark for the card, as a PNG data URL. A missing file leaves the name on its own. */
export async function readModelLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const url = /^https?:\/\//i.test(path) ? path : publicLogo(path);
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const parsed = readLogo(bytes);
    if (!parsed || parsed.ext !== "png") return null;
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

function publicLogo(path: string): string | null {
  const base = publicEnv()?.url;
  if (!base) return null;
  return logoPublicUrl(base, path);
}
