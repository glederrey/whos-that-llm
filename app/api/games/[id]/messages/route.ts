import { apiError, apiJson } from "@/lib/http";
import { buildModelMessages, streamHiddenReply } from "@/lib/openrouter";
import { abortReply, claimCall, hiddenCall, readPublicGame, saveReply } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = typeof body.text === "string" ? body.text : "";
  const trimmed = text.trim();

  const hidden = await hiddenCall(id, user.id);
  if (!hidden) return apiJson({ error: "not_found" }, 404);
  if (!trimmed || trimmed.length > hidden.game.rules.maxUserChars) return apiJson({ error: "turn" }, 422);

  const claimed = await claimCall(id, user.id);
  if (claimed) return apiError(claimed);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        const reply = await streamHiddenReply({
          openrouterId: hidden.openrouterId,
          providerSettings: hidden.providerSettings,
          maxOutputTokens: hidden.game.rules.maxOutputTokens,
          messages: buildModelMessages([
            ...hidden.transcript,
            { role: "user", content: trimmed },
          ]),
          onWord(word) {
            send({ type: "word", text: word });
          },
        });
        if (!reply.ok) {
          await abortReply(id, user.id, reply.paused);
          send({ type: "error", error: "upstream", paused: reply.paused });
          return;
        }
        const saved = await saveReply(id, user.id, trimmed, reply.text, reply.usage);
        if (saved) {
          send({ type: "error", error: saved.error, paused: false });
          return;
        }
        const game = await readPublicGame(id, user.id);
        send({ type: "game", game });
      } catch {
        await abortReply(id, user.id, false);
        send({ type: "error", error: "upstream", paused: false });
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
