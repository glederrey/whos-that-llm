import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { twemojiCode, TWEMOJI_CODE } from "./twemoji";

const DIR = path.join(process.cwd(), "node_modules", "@twemoji", "svg");

/** The Twemoji picture of an emoji as a data URI the card image can draw. Null when the file is missing. */
export async function readFlagImage(emoji: string): Promise<string | null> {
  const code = twemojiCode(emoji);
  if (!TWEMOJI_CODE.test(code)) return null;
  try {
    const svg = await readFile(path.join(DIR, `${code}.svg`));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}
