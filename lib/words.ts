/** Split a growing reply into complete words, keeping a trailing partial word. */
export function takeWords(
  pending: string,
  incoming: string,
  flush: boolean,
): { emit: string[]; rest: string } {
  const text = pending + incoming;
  if (!text) return { emit: [], rest: "" };
  if (flush) return { emit: tokenize(text), rest: "" };
  const match = text.match(/^([\s\S]*\s)(\S*)$/);
  if (!match || !match[1]) return { emit: [], rest: text };
  return { emit: tokenize(match[1]), rest: match[2] ?? "" };
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}
