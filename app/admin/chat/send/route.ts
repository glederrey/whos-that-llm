import { requireOwner } from "@/lib/admin-access";
import { chatTurns, parseAdminChat } from "@/lib/admin-chat";
import { config } from "@/lib/config";
import { apiJson } from "@/lib/http";
import { streamPlayedReply } from "@/lib/openrouter";
import { sseResponse } from "@/lib/reply-events";
import { serviceOrThrow } from "@/lib/rounds";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  await requireOwner();
  const parsed = parseAdminChat(await request.json().catch(() => null));
  if (!parsed) return apiJson({ error: "invalid" }, 422);

  const client = serviceOrThrow();
  const { data, error } = await client
    .from("models")
    .select("openrouter_id, provider_settings")
    .eq("id", parsed.modelId)
    .maybeSingle();
  if (error || !data?.openrouter_id) return apiJson({ error: "not_found" }, 404);

  const openrouterId = data.openrouter_id as string;
  const providerSettings = data.provider_settings;

  return sseResponse(async (send) => {
    try {
      const reply = await streamPlayedReply({
        openrouterId,
        providerSettings,
        maxOutputTokens: config.maxOutputTokens,
        transcript: chatTurns(parsed.transcript),
        userText: parsed.text.trim(),
        onWord(word) {
          send({ type: "word", text: word });
        },
      });
      if (!reply.ok) {
        send({ type: "error", message: reply.message, sent: reply.sent });
        return;
      }
      send({
        type: "done",
        text: reply.text,
        promptTokens: reply.tokens.input,
        completionTokens: reply.tokens.output,
        reasoningTokens: reply.tokens.reasoning,
        cacheReadTokens: reply.tokens.cacheRead,
        sent: reply.sent,
      });
    } catch {
      send({ type: "error", message: "The reply failed." });
    }
  });
}
