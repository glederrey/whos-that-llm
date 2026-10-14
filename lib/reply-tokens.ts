import { scoreTokens } from "./game";

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

function shownCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The same input and output the score counts. Reasoning and cache read stay beside that count. */
export function replyTokenLines(calls: MeasuredCall[]): ReplyTokens[] {
  const scored = scoreTokens(
    calls.map((call) => ({
      inputTokens: call.promptTokens,
      outputTokens: call.completionTokens,
    })),
  );
  let sinceStart = 0;
  return calls.map((call, index) => {
    const turn = scored.turns[index];
    sinceStart += turn.inputTokens;
    return {
      input: turn.inputTokens,
      output: turn.outputTokens,
      sinceStart,
      rawPrompt: shownCount(call.promptTokens),
      reasoning: shownCount(call.reasoningTokens),
      cacheRead: shownCount(call.cacheReadTokens),
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
