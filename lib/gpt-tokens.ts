import { countTokens } from "gpt-tokenizer";

/** Visible-text token count using OpenAI's o200k encoding. An estimate for other models. */
export function countGptTokens(text: string): number {
  if (!text) return 0;
  return countTokens(text);
}
