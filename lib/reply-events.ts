import type { PublicGame } from "./game";

export type ReplyEvent = {
  type: string;
  text?: string;
  error?: string;
  paused?: boolean;
  message?: string;
  game?: PublicGame;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
};

export function sseResponse(start: (send: (payload: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        await start(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function readReplyEvents(response: Response, onEvent: (event: ReplyEvent) => void): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)) as ReplyEvent);
    }
  }
}
