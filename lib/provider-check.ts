import { settingsEmpty } from "./admin-model";
import { takeWords } from "./words";

/** Pause between paced words. A short reply still reads as a stream. */
export const revealGapMs = 40;

/** A long held reply is released in batches so the pacing stays under this. */
export const revealBudgetMs = 1800;

/**
 * Words released together. One word at a time until the budget would be exceeded,
 * then larger steps so the whole reply still finishes inside it.
 */
export function revealStride(wordCount: number): number {
  if (wordCount <= 1) return 1;
  const ticks = Math.max(1, Math.floor(revealBudgetMs / revealGapMs));
  return Math.max(1, Math.ceil(wordCount / ticks));
}

export async function emitPaced(words: string[], onWord: (word: string) => void, pace: boolean): Promise<void> {
  if (words.length === 0) return;
  const stride = pace ? revealStride(words.length) : words.length;
  for (let index = 0; index < words.length; index += stride) {
    for (const word of words.slice(index, index + stride)) onWord(word);
    if (pace && index + stride < words.length) await delay(revealGapMs);
  }
}

/** Release a held reply as words, with pauses, instead of one block of text. */
export async function revealWords(text: string, onWord: (word: string) => void): Promise<void> {
  await emitPaced(takeWords("", text, true).emit, onWord, true);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Completion tokens that belong to the visible reply. Reported reasoning inside that count is removed. */
export function visibleOutput(output: number, reasoning: number): number {
  if (reasoning > 0 && reasoning <= output) return output - reasoning;
  return output;
}

/**
 * Extra tokens that are too few to judge. Four tokens on a short greeting is a tokenizer
 * mismatch, not hidden text. The 10% rule applies once the gap is larger than this.
 */
export const outputGapSlack = 16;

/**
 * True when the provider's visible output is more than 10% above the gpt-tokenizer count
 * and the gap is more than {@link outputGapSlack} tokens.
 * Exactly 10% is kept. A gap of 16 tokens or fewer is kept. A tokenizer count above the
 * reported output is kept: that is not hidden text.
 */
export function outputAboveCount(gptTokens: number, output: number, reasoning: number): boolean {
  const visible = visibleOutput(output, reasoning);
  const gap = visible - gptTokens;
  return gap > outputGapSlack && visible * 10 > gptTokens * 11;
}

export function outputGapPercent(gptTokens: number, output: number, reasoning: number): number {
  const visible = visibleOutput(output, reasoning);
  const base = Math.max(gptTokens, 1);
  return Math.round(((visible - gptTokens) / base) * 100);
}

export function formatSentTranscript(sent: readonly { role: string; content: string }[]): string {
  return sent.map((turn) => `${turn.role}\n${turn.content}`).join("\n\n");
}

export function blacklistReason(input: {
  at: Date;
  model: string;
  provider: string;
  inputText: string;
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  gptTokens: number;
}): string {
  const visible = visibleOutput(input.outputTokens, input.reasoningTokens);
  const lines = [
    `Visible output is ${outputGapPercent(input.gptTokens, input.outputTokens, input.reasoningTokens)}% above the gpt-tokenizer count of the reply (threshold 10%, and more than ${outputGapSlack} tokens).`,
  ];
  if (visible !== input.outputTokens) {
    lines.push(
      `Compared ${visible.toLocaleString("en-US")} output tokens after subtracting ${input.reasoningTokens.toLocaleString("en-US")} reported reasoning tokens.`,
    );
  }
  lines.push(
    `Date: ${input.at.toISOString()}`,
    `Model: ${input.model}`,
    `Provider: ${input.provider}`,
    `Input tokens: ${input.inputTokens.toLocaleString("en-US")}`,
    `Output tokens: ${input.outputTokens.toLocaleString("en-US")}`,
    `Reasoning tokens: ${input.reasoningTokens.toLocaleString("en-US")}`,
    `Cached tokens: ${input.cachedTokens.toLocaleString("en-US")}`,
    `gpt-tokenizer: ${input.gptTokens.toLocaleString("en-US")}`,
    "",
    "Input:",
    input.inputText,
    "",
    "Output:",
    input.outputText,
  );
  return lines.join("\n");
}

export function validProviderSlug(value: string): boolean {
  const slug = value.trim();
  return slug.length > 0 && slug.length <= 80 && !/[\s]/.test(slug);
}

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

/** OpenRouter options for one call. Blacklisted slugs are ignored. */
export function openRouterRequestOptions(
  settings: unknown,
  reasoning: boolean,
  ignore: readonly string[],
): Record<string, unknown> {
  const base = plainObject(settings);
  const storedProvider = plainObject(base.provider);
  const merged = [...new Set([...stringList(storedProvider.ignore), ...stringList(ignore)])];
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (key === "reasoning" || key === "provider") continue;
    next[key] = value;
  }
  next.usage = { include: true };
  if (merged.length > 0 || Object.keys(storedProvider).length > 0) {
    const provider = { ...storedProvider };
    if (merged.length > 0) provider.ignore = merged;
    next.provider = provider;
  }
  // Paused so a call can use the provider default instead of effort low.
  // if (reasoning) next.reasoning = { effort: "low" };
  return next;
}

export function providerSlug(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const direct = record.provider;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = plainObject(record.openrouter).provider;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return null;
}

export function lowReasoningSettings(): { reasoning: { effort: "low" } } {
  return { reasoning: { effort: "low" } };
}

export function reasoningSettingsNeeded(reasoning: boolean, providerSettings: unknown): boolean {
  return reasoning && settingsEmpty(providerSettings);
}
