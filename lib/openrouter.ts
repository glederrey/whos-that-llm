import type { JSONObject } from "@ai-sdk/provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, streamText, type ModelMessage } from "ai";
import { systemPrompt } from "./prompt";
import { isCreditError } from "./game";
import { countGptTokens } from "./gpt-tokens";
import {
  blacklistReason,
  emitPaced,
  formatSentTranscript,
  openRouterRequestOptions,
  outputAboveCount,
  providerSlug,
} from "./provider-check";
import type { ProviderBook, ProviderVerdict } from "./openrouter-providers";
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
  | { ok: true; text: string; usage: CallUsage; tokens: CallTokens; sent: SentTurn[]; gptTokens: number }
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
  reasoning: boolean;
  maxOutputTokens: number;
  messages: ModelMessage[];
  onWord: (word: string) => void;
}): Promise<StreamedReply> {
  const system = systemPrompt();
  const messages = input.messages;
  const sent = callInput(system, messages);
  const apiKey = readServerEnv("OPENROUTER_API_KEY");
  if (!apiKey) return { ok: false, paused: false, message: "Missing OpenRouter key.", sent };

  let book: ProviderBook = { trusted: new Set(), ignored: [] };
  try {
    book = await (await import("./openrouter-providers")).loadProviderBook();
  } catch {
    book = { trusted: new Set(), ignored: [] };
  }

  const openrouter = createOpenRouter({ apiKey });
  const ignored = [...book.ignored];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await oneCall({
      openrouter,
      openrouterId: input.openrouterId,
      providerSettings: input.providerSettings,
      reasoning: input.reasoning,
      maxOutputTokens: input.maxOutputTokens,
      system,
      messages,
      sent,
      ignore: ignored,
      trusted: book.trusted,
      onWord: input.onWord,
    });
    if (!outcome.ok) return outcome.reply;
    if (!input.reasoning) {
      await outcome.done();
      return outcome.reply;
    }

    const over = outputAboveCount(outcome.reply.gptTokens, outcome.reply.tokens.output, outcome.reply.tokens.reasoning);
    if (outcome.streamed) {
      if (over && outcome.slug) await remember(verdict(input.openrouterId, outcome, true));
      await outcome.done();
      return outcome.reply;
    }

    if (!over) {
      if (outcome.slug && !book.trusted.has(outcome.slug)) await remember(verdict(input.openrouterId, outcome, false));
      await outcome.reveal();
      return outcome.reply;
    }

    if (outcome.slug) {
      await remember(verdict(input.openrouterId, outcome, true));
      if (!ignored.includes(outcome.slug)) ignored.push(outcome.slug);
    }
    if (attempt === 1 || !outcome.slug) {
      await outcome.reveal();
      return outcome.reply;
    }
  }

  return { ok: false, paused: false, message: "The reply failed.", sent };
}

type Attempt =
  | { ok: false; reply: StreamedReply }
  | {
      ok: true;
      reply: Extract<StreamedReply, { ok: true }>;
      slug: string | null;
      streamed: boolean;
      done: () => Promise<void>;
      reveal: () => Promise<void>;
    };

async function oneCall(input: {
  openrouter: ReturnType<typeof createOpenRouter>;
  openrouterId: string;
  providerSettings: unknown;
  reasoning: boolean;
  maxOutputTokens: number;
  system: string;
  messages: ModelMessage[];
  sent: SentTurn[];
  ignore: string[];
  trusted: Set<string>;
  onWord: (word: string) => void;
}): Promise<Attempt> {
  let streamError: unknown = null;
  const result = streamText({
    model: input.openrouter(input.openrouterId),
    system: input.system,
    messages: input.messages,
    temperature: 0.8,
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: 0,
    includeRawChunks: true,
    providerOptions: {
      openrouter: openRouterRequestOptions(input.providerSettings, input.reasoning, input.ignore) as JSONObject,
    },
    onError({ error }) {
      streamError = error;
    },
  });

  const out = createWordOut(input.onWord);
  let mode: "pending" | "live" | "hold" = input.reasoning ? "pending" : "live";
  let slug: string | null = null;
  let text = "";

  function rememberSlug(value: unknown) {
    const found = providerSlug(value);
    if (!found || slug) return;
    slug = found;
  }

  function startLiveIfTrusted() {
    if (!input.reasoning || mode !== "pending" || !slug) return;
    if (!input.trusted.has(slug) || input.ignore.includes(slug)) {
      mode = "hold";
      return;
    }
    mode = "live";
    if (text) out.push(text, false, true);
  }

  try {
    for await (const part of result.fullStream) {
      if (part.type === "raw") {
        rememberSlug(part.rawValue);
        startLiveIfTrusted();
      } else if (part.type === "finish-step") {
        rememberSlug(part.providerMetadata);
      } else if (part.type === "text-delta") {
        text += part.text;
        if (mode === "live") out.push(part.text, false, false);
      } else if (part.type === "error") {
        streamError = part.error;
      }
    }
  } catch (error) {
    streamError = error;
  }

  if (streamError) {
    if (mode === "live") await out.finish();
    return { ok: false, reply: fail(streamError, input.sent) };
  }

  const finish = await Promise.resolve(result.finishReason).catch(() => "error" as const);
  if (finish === "error") {
    if (mode === "live") await out.finish();
    return { ok: false, reply: fail(streamError ?? new Error("The reply failed."), input.sent) };
  }

  const usage = await result.usage;
  const metadata = await Promise.resolve(result.providerMetadata).catch(() => undefined);
  const response = await Promise.resolve(result.response).catch(() => undefined);
  rememberSlug(metadata);
  const openrouterMeta = metadata?.openrouter as Record<string, unknown> | undefined;
  const accounted = (openrouterMeta?.usage ?? {}) as Record<string, unknown>;
  const tokens = rawCallTokens(
    {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
      cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
    },
    accounted,
  );
  const reply: Extract<StreamedReply, { ok: true }> = {
    ok: true,
    text,
    tokens,
    gptTokens: countGptTokens(text),
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
    sent: input.sent,
  };

  if (mode === "live") out.push("", true, false);

  return {
    ok: true,
    reply,
    slug,
    streamed: mode === "live",
    done: () => out.finish(),
    reveal: () => {
      out.reveal(text);
      return out.finish();
    },
  };
}

function verdict(model: string, outcome: Extract<Attempt, { ok: true }>, blacklisted: boolean): ProviderVerdict {
  const slug = outcome.slug ?? "";
  return {
    slug,
    blacklisted,
    reason: blacklisted
      ? blacklistReason({
          at: new Date(),
          model,
          provider: slug,
          inputText: formatSentTranscript(outcome.reply.sent),
          outputText: outcome.reply.text,
          inputTokens: outcome.reply.tokens.input,
          outputTokens: outcome.reply.tokens.output,
          reasoningTokens: outcome.reply.tokens.reasoning,
          cachedTokens: outcome.reply.tokens.cacheRead,
          gptTokens: outcome.reply.gptTokens,
        })
      : null,
    model,
    inputText: formatSentTranscript(outcome.reply.sent),
    outputText: outcome.reply.text,
    inputTokens: outcome.reply.tokens.input,
    outputTokens: outcome.reply.tokens.output,
    reasoningTokens: outcome.reply.tokens.reasoning,
    cachedTokens: outcome.reply.tokens.cacheRead,
    gptTokens: outcome.reply.gptTokens,
  };
}

async function remember(verdictToSave: ProviderVerdict) {
  try {
    await (await import("./openrouter-providers")).saveProviderVerdict(verdictToSave);
  } catch {
    // The in-memory ignore list still skips this slug for the retry.
  }
}

function createWordOut(onWord: (word: string) => void) {
  let rest = "";
  let chain = Promise.resolve();

  function enqueue(words: string[], pace: boolean) {
    if (words.length === 0) return;
    chain = chain.then(() => emitPaced(words, onWord, pace));
  }

  return {
    push(chunk: string, flush: boolean, pace: boolean) {
      const next = takeWords(rest, chunk, flush);
      rest = next.rest;
      enqueue(next.emit, pace);
    },
    reveal(text: string) {
      rest = "";
      enqueue(takeWords("", text, true).emit, true);
    },
    finish() {
      return chain;
    },
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
  reasoning: boolean;
  maxOutputTokens: number;
  transcript: { role: "user" | "assistant"; content: string }[];
  userText: string;
  onWord: (word: string) => void;
}): Promise<StreamedReply> {
  return streamHiddenReply({
    openrouterId: input.openrouterId,
    providerSettings: input.providerSettings,
    reasoning: input.reasoning,
    maxOutputTokens: input.maxOutputTokens,
    messages: buildModelMessages([...input.transcript, { role: "user", content: input.userText }]),
    onWord: input.onWord,
  });
}
