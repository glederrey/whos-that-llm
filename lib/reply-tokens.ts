export type MeasuredCall = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  /** gpt-tokenizer count of the visible reply. Absent until the call has finished. */
  gptTokens?: number;
  /** OpenRouter provider slug for this call, such as chutes. Absent until the call names one. */
  provider?: string | null;
};

export type ReplyTokens = {
  /** New input for this reply. The first prompt, or this prompt minus the previous prompt and the previous reply text that was sent again. */
  input: number;
  /** OpenRouter completion count. Reasoning is inside this when it does not exceed it. */
  output: number;
  sinceStart: number;
  /** Running sum of completion tokens, with reasoning that was inside the count removed. */
  outputTotal: number;
  /** OpenRouter prompt tokens for this call. Used to check the running sum, not as that sum. */
  rawPrompt: number;
  /** Reported reasoning, plus completion tokens the next prompt shows were not sent again when the provider reported none. */
  reasoning: number;
  cacheRead: number;
  /** gpt-tokenizer count of this visible reply, or null when the call did not send one. */
  gptTokens: number | null;
  /** OpenRouter provider slug, or null when the call did not name one. */
  provider: string | null;
};

function shownCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function shownGpt(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shownProvider(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug ? slug : null;
}

/**
 * Completion tokens that went back into the next prompt.
 * Reasoning is inside the completion count when it does not exceed it, and that text is not sent again.
 */
export function resentCompletion(output: number, reasoning: number): number {
  if (reasoning > 0 && reasoning <= output) return output - reasoning;
  return output;
}

/**
 * Completion tokens a provider left inside the output count without calling them reasoning.
 * The next prompt is the check: it cannot contain more of that reply than it grew.
 * A reported reasoning count is trusted, including when it is larger than the completion.
 */
export function unlabeledReasoning(output: number, reasoning: number, prompt: number, nextPrompt: number | null): number {
  if (nextPrompt === null || reasoning > 0) return 0;
  const room = Math.max(0, nextPrompt - prompt);
  if (output <= room) return 0;
  return output - room;
}

/** Input added by each reply. Reasoning that was not sent again is left out of the subtraction. Cache read is not used. */
export function replyTokenLines(calls: MeasuredCall[]): ReplyTokens[] {
  let sinceStart = 0;
  let outputTotal = 0;
  return calls.map((call, index) => {
    const prompt = shownCount(call.promptTokens);
    const output = shownCount(call.completionTokens);
    const next = index + 1 < calls.length ? calls[index + 1] : null;
    const reasoning =
      shownCount(call.reasoningTokens) +
      unlabeledReasoning(output, shownCount(call.reasoningTokens), prompt, next ? shownCount(next.promptTokens) : null);
    const previous = index === 0 ? null : calls[index - 1];
    const previousPrompt = previous ? shownCount(previous.promptTokens) : 0;
    const previousOutput = previous ? shownCount(previous.completionTokens) : 0;
    const previousReasoning = previous
      ? shownCount(previous.reasoningTokens) +
        unlabeledReasoning(previousOutput, shownCount(previous.reasoningTokens), previousPrompt, prompt)
      : 0;
    const input = previous
      ? prompt - previousPrompt - resentCompletion(previousOutput, previousReasoning)
      : prompt;
    sinceStart += input;
    outputTotal += resentCompletion(output, reasoning);
    return {
      input,
      output,
      sinceStart,
      outputTotal,
      rawPrompt: prompt,
      reasoning,
      cacheRead: shownCount(call.cacheReadTokens),
      gptTokens: shownGpt(call.gptTokens),
      provider: shownProvider(call.provider),
    };
  });
}

/** The running input plus earlier resent completions equals this call's raw prompt. */
export function inputSinceStartMatchesPrompt(views: ReplyTokens[]): boolean {
  return views.every((view, index) => {
    const earlier = views.slice(0, index).reduce((sum, item) => sum + resentCompletion(item.output, item.reasoning), 0);
    return view.sinceStart + earlier === view.rawPrompt;
  });
}

export function replyTokenTooltip(tokens: ReplyTokens): string[] {
  const count = (value: number) => value.toLocaleString("en-US");
  return [
    ...(tokens.provider ? [`Provider: ${tokens.provider}`, ""] : []),
    `Input tokens: ${count(tokens.input)}`,
    `Output tokens: ${count(resentCompletion(tokens.output, tokens.reasoning))}`,
    ...(tokens.gptTokens === null ? [] : [`gpt-tokenizer: ${count(tokens.gptTokens)}`]),
    `Reasoning tokens: ${count(tokens.reasoning)}`,
    `Cache read tokens: ${count(tokens.cacheRead)}`,
    "",
    `Prompt tokens: ${count(tokens.rawPrompt)}`,
    `Total input tokens: ${count(tokens.sinceStart)}`,
    `Total output tokens: ${count(tokens.outputTotal)}`,
    `Total tokens: ${count(tokens.sinceStart + tokens.outputTotal)}`,
  ];
}
