import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, streamText, type ModelMessage } from "ai";
import { systemPrompt } from "./prompt";
import { isCreditError } from "./game";
import { takeWords } from "./words";

export type CallUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  generationId: string | null;
};

export type StreamedReply =
  | { ok: true; text: string; usage: CallUsage }
  | { ok: false; paused: boolean; message: string };

function providerSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function numberFrom(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function streamHiddenReply(input: {
  openrouterId: string;
  providerSettings: unknown;
  maxOutputTokens: number;
  transcript: { role: "user" | "assistant"; content: string }[];
  onWord: (word: string) => void;
}): Promise<StreamedReply> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, paused: false, message: "Missing OpenRouter key." };

  const openrouter = createOpenRouter({ apiKey });
  const messages: ModelMessage[] = input.transcript.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let streamError: unknown = null;
  const result = streamText({
    model: openrouter(input.openrouterId),
    system: systemPrompt,
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

  if (streamError) return fail(streamError);

  const finish = await Promise.resolve(result.finishReason).catch(() => "error" as const);
  if (finish === "error") return fail(streamError ?? new Error("The reply failed."));

  const usage = await result.usage;
  const metadata = await Promise.resolve(result.providerMetadata).catch(() => undefined);
  const response = await Promise.resolve(result.response).catch(() => undefined);
  const openrouterMeta = metadata?.openrouter as Record<string, unknown> | undefined;
  const accounted = (openrouterMeta?.usage ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    text,
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
  };
}

function fail(error: unknown): StreamedReply {
  const message = error instanceof Error ? error.message : "The reply failed.";
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const body = APICallError.isInstance(error) ? JSON.stringify(error.responseBody ?? "") : "";
  return { ok: false, paused: isCreditError(status, `${message} ${body}`), message };
}
