import { isUuid } from "@/lib/paths";
import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { streamPlayedReply } from "@/lib/openrouter";
import { sseResponse } from "@/lib/reply-events";
import { abortReply, claimCall, hiddenCall, readPublicGame, saveReply } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  if (!isUuid(id)) return apiJson({ error: "not_found" }, 404);
  const body = (await readJsonBody(request)) as { text?: string };
  const text = typeof body.text === "string" ? body.text : "";
  const trimmed = text.trim();

  const hidden = await hiddenCall(id, user.id);
  if (!hidden) return apiJson({ error: "not_found" }, 404);
  if (!trimmed || trimmed.length > hidden.game.rules.maxUserChars) return apiJson({ error: "turn" }, 422);

  const claimed = await claimCall(id, user.id);
  if (claimed) return apiError(claimed);

  return sseResponse(async (send) => {
    try {
      const reply = await streamPlayedReply({
        openrouterId: hidden.openrouterId,
        providerSettings: hidden.providerSettings,
        reasoning: hidden.reasoning,
        maxOutputTokens: hidden.game.rules.maxOutputTokens,
        transcript: hidden.transcript,
        userText: trimmed,
        context: hidden.context,
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
    }
  });
}
