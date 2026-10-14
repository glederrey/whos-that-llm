import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, streamText, type ModelMessage } from "ai";
import { systemPrompt } from "./prompt";
import { isCreditError } from "./game";
import { readServerEnv } from "./server-env";
import { takeWords } from "./words";

export type CallUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  generationId: string | null;
};

export type CallTokens = {
  /** Raw prompt tokens for this call, including the system prompt and history. */
  input: number;
  /** Raw completion tokens for this call. */
  output: number;
  /** Reasoning tokens reported for this call. Display only. */
  reasoning: number;
  /** Cache-read tokens reported for this call. Display only. */
  cacheRead: number;
};

export type SentTurn = { role: "system" | "user" | "assistant"; content: string };

export type StreamedReply =
  | { ok: true; text: string; usage: CallUsage; tokens: CallTokens; sent: SentTurn[] }
  | { ok: false; paused: boolean; message: string; sent: SentTurn[] };

/** The system prompt and messages passed to the model for one call. */
export function callInput(system: string, messages: readonly { role: string; content: unknown }[]): SentTurn[] {
  const sent: SentTurn[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    sent.push({ role: message.role, content: messageText(message.content) });
  }
  return sent;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

/** OpenRouter totals for one call. Reasoning and cache read stay beside the prompt and completion counts. */
export function rawCallTokens(
  sdk: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    reasoningTokens?: number | undefined;
    cacheReadTokens?: number | undefined;
  },
  openrouterUsage: object | null | undefined,
): CallTokens {
  const record =
    openrouterUsage && typeof openrouterUsage === "object" ? (openrouterUsage as Record<string, unknown>) : {};
  const completionDetails = detailRecord(record.completionTokensDetails);
  const promptDetails = detailRecord(record.promptTokensDetails);
  return {
    input: optionalCount(record.promptTokens) ?? optionalCount(sdk.inputTokens) ?? 0,
    output: optionalCount(record.completionTokens) ?? optionalCount(sdk.outputTokens) ?? 0,
    reasoning: optionalCount(completionDetails?.reasoningTokens) ?? optionalCount(sdk.reasoningTokens) ?? 0,
    cacheRead: optionalCount(promptDetails?.cachedTokens) ?? optionalCount(sdk.cacheReadTokens) ?? 0,
  };
}

function detailRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function providerSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function numberFrom(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildModelMessages(
  transcript: { role: "user" | "assistant"; content: string }[],
): ModelMessage[] {
  return transcript.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function streamHiddenReply(input: {
  openrouterId: string;
  providerSettings: unknown;
  maxOutputTokens: number;
  messages: ModelMessage[];
  onWord: (word: string) => void;
}): Promise<StreamedReply> {
  const system = systemPrompt();
  const messages = input.messages;
  const sent = callInput(system, messages);
  const apiKey = readServerEnv("OPENROUTER_API_KEY");
  if (!apiKey) return { ok: false, paused: false, message: "Missing OpenRouter key.", sent };

  const openrouter = createOpenRouter({ apiKey });

  let streamError: unknown = null;
  const result = streamText({
    model: openrouter(input.openrouterId),
    system,
    messages,
    temperature: 0.8,
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: 0,
    providerOptions: {
      openrouter: {
        ...providerSettings(input.providerSettings),
        usage: { include: true },
      },
    },
    onError({ error }) {
      streamError = error;
    },
  });

  let pending = "";
  let text = "";
  try {
    for await (const chunk of result.textStream) {
      text += chunk;
      const next = takeWords(pending, chunk, false);
      pending = next.rest;
      for (const word of next.emit) input.onWord(word);
    }
    const flushed = takeWords(pending, "", true);
    for (const word of flushed.emit) input.onWord(word);
  } catch (error) {
    streamError = error;
  }

  if (streamError) return fail(streamError, sent);

  const finish = await Promise.resolve(result.finishReason).catch(() => "error" as const);
  if (finish === "error") return fail(streamError ?? new Error("The reply failed."), sent);

  const usage = await result.usage;
  const metadata = await Promise.resolve(result.providerMetadata).catch(() => undefined);
  const response = await Promise.resolve(result.response).catch(() => undefined);
  const openrouterMeta = metadata?.openrouter as Record<string, unknown> | undefined;
  const accounted = (openrouterMeta?.usage ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    text,
    tokens: rawCallTokens(
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
        cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
      },
      accounted,
    ),
    usage: {
      inputTokens: usage.inputTokens ?? numberFrom(accounted.promptTokens),
      outputTokens: usage.outputTokens ?? numberFrom(accounted.completionTokens),
      reasoningTokens:
        usage.outputTokenDetails?.reasoningTokens ??
        numberFrom((accounted.completionTokensDetails as { reasoningTokens?: number } | undefined)?.reasoningTokens),
      cacheReadTokens:
        usage.inputTokenDetails?.cacheReadTokens ??
        numberFrom((accounted.promptTokensDetails as { cachedTokens?: number } | undefined)?.cachedTokens),
      costUsd: numberFrom(accounted.cost),
      generationId: response?.id ?? null,
    },
    sent,
  };
}

function fail(error: unknown, sent: SentTurn[]): StreamedReply {
  const message = error instanceof Error ? error.message : "The reply failed.";
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const body = APICallError.isInstance(error) ? JSON.stringify(error.responseBody ?? "") : "";
  return { ok: false, paused: isCreditError(status, `${message} ${body}`), message, sent };
}

/** The model call a round uses: the game system prompt, then the transcript plus the new player message. */
export async function streamPlayedReply(input: {
  openrouterId: string;
  providerSettings: unknown;
  maxOutputTokens: number;
  transcript: { role: "user" | "assistant"; content: string }[];
  userText: string;
  onWord: (word: string) => void;
}): Promise<StreamedReply> {
  return streamHiddenReply({
    openrouterId: input.openrouterId,
    providerSettings: input.providerSettings,
    maxOutputTokens: input.maxOutputTokens,
    messages: buildModelMessages([...input.transcript, { role: "user", content: input.userText }]),
    onWord: input.onWord,
  });
}
