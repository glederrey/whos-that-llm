/** A model reply with no visible characters. Whitespace counts as empty. */
export function isEmptyModelReply(content: string): boolean {
  return content.trim() === "";
}
