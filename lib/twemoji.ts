/** Twemoji file name (no extension) of an emoji: lowercase hex code points joined by "-". As in Twemoji's own `toCodePoint`, U+FE0F is dropped unless the sequence has a ZWJ (U+200D). */
export function twemojiCode(emoji: string): string {
  const text = emoji.includes("‍") ? emoji : emoji.replaceAll("️", "");
  return Array.from(text, (ch) => ch.codePointAt(0)!.toString(16)).join("-");
}

/** Only what `twemojiCode` can produce, so a code never reaches the file system with a path in it. */
export const TWEMOJI_CODE = /^[0-9a-f]+(-[0-9a-f]+)*$/;

/** Same-origin URL of the Twemoji picture served by `app/emoji/[code]/route.ts`. */
export function twemojiUrl(emoji: string): string {
  return `/emoji/${twemojiCode(emoji)}`;
}
