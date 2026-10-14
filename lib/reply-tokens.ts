export type MeasuredCall = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
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
  reasoning: number;
  cacheRead: number;
};

function shownCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Completion tokens that went back into the next prompt.
 * Reasoning is inside the completion count when it does not exceed it, and that text is not sent again.
 */
export function resentCompletion(output: number, reasoning: number): number {
  if (reasoning > 0 && reasoning <= output) return output - reasoning;
  return output;
}

/** Input added by each reply. Reasoning that was not sent again is left out of the subtraction. Cache read is not used. */
export function replyTokenLines(calls: MeasuredCall[]): ReplyTokens[] {
  let sinceStart = 0;
  let outputTotal = 0;
  return calls.map((call, index) => {
    const prompt = shownCount(call.promptTokens);
    const output = shownCount(call.completionTokens);
    const reasoning = shownCount(call.reasoningTokens);
    const previous = index === 0 ? null : calls[index - 1];
    const input = previous
      ? prompt - shownCount(previous.promptTokens) - resentCompletion(shownCount(previous.completionTokens), shownCount(previous.reasoningTokens))
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
    `Input tokens: ${count(tokens.input)}`,
    `Output tokens: ${count(resentCompletion(tokens.output, tokens.reasoning))}`,
    `Reasoning tokens: ${count(tokens.reasoning)}`,
    `Cache read tokens: ${count(tokens.cacheRead)}`,
    "",
    `Prompt tokens: ${count(tokens.rawPrompt)}`,
    `Total input tokens: ${count(tokens.sinceStart)}`,
    `Total output tokens: ${count(tokens.outputTotal)}`,
    `Total tokens: ${count(tokens.sinceStart + tokens.outputTotal)}`,
  ];
}
