export type MeasuredCall = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
};

export type ReplyTokens = {
  /** New input for this reply: the first prompt, or this prompt minus the previous prompt and previous completion. */
  input: number;
  output: number;
  sinceStart: number;
  /** OpenRouter prompt tokens for this call. Used to check the running sum, not as that sum. */
  rawPrompt: number;
  reasoning: number;
  cacheRead: number;
};

export function replyTokenLines(calls: MeasuredCall[]): ReplyTokens[] {
  let sinceStart = 0;
  return calls.map((call, index) => {
    const previous = calls[index - 1];
    const input = previous
      ? call.promptTokens - previous.promptTokens - previous.completionTokens
      : call.promptTokens;
    sinceStart += input;
    return {
      input,
      output: call.completionTokens,
      sinceStart,
      rawPrompt: call.promptTokens,
      reasoning: call.reasoningTokens ?? 0,
      cacheRead: call.cacheReadTokens ?? 0,
    };
  });
}

/** The running input plus earlier completion tokens equals this call's raw prompt. */
export function inputSinceStartMatchesPrompt(views: ReplyTokens[]): boolean {
  return views.every((view, index) => {
    const earlierOutput = views.slice(0, index).reduce((sum, item) => sum + item.output, 0);
    return view.sinceStart + earlierOutput === view.rawPrompt;
  });
}

export function replyTokenTooltip(tokens: ReplyTokens): string[] {
  const count = (value: number) => value.toLocaleString("en-US");
  return [
    `Input tokens: ${count(tokens.input)}`,
    `Output tokens: ${count(tokens.output)}`,
    `Input tokens since the start of the conversation: ${count(tokens.sinceStart)}`,
    `Reasoning tokens: ${count(tokens.reasoning)}`,
    `Cache read tokens: ${count(tokens.cacheRead)}`,
  ];
}
