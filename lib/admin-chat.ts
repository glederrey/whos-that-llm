import { parseModelId } from "./admin-model";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type VisibleTurn = { role: "user" | "assistant"; content: string; failed?: boolean };

export function parseAdminChat(body: unknown): { modelId: string; text: string; transcript: ChatTurn[] } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { modelId?: unknown; text?: unknown; transcript?: unknown };
  const modelId = typeof record.modelId === "string" ? parseModelId(record.modelId) : null;
  if (!modelId || typeof record.text !== "string" || !record.text.trim()) return null;
  const transcript = parseTranscript(record.transcript);
  if (!transcript) return null;
  return { modelId, text: record.text, transcript };
}

export function chatTurns(messages: ChatTurn[]): ChatTurn[] {
  return messages.map((message) =>
    message.role === "user" ? { role: "user", content: message.content.trim() } : { role: "assistant", content: message.content },
  );
}

/** Prior turns to send with the next player message. A failed reply stays on screen and is left out of the call. */
export function transcriptForCall(visible: VisibleTurn[]): ChatTurn[] {
  const kept: ChatTurn[] = [];
  for (let index = 0; index < visible.length; index++) {
    const message = visible[index];
    if (message.failed) continue;
    const next = visible[index + 1];
    if (message.role === "user" && next?.failed) continue;
    kept.push({ role: message.role, content: message.content });
  }
  return kept;
}

function parseTranscript(value: unknown): ChatTurn[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const turn = item as { role?: unknown; content?: unknown };
    if (turn.role !== "user" && turn.role !== "assistant") return null;
    if (typeof turn.content !== "string") return null;
    if (turn.role === "user" && !turn.content.trim()) return null;
    turns.push({ role: turn.role, content: turn.content });
  }
  if (turns.length % 2 !== 0) return null;
  for (let index = 0; index < turns.length; index++) {
    const expected = index % 2 === 0 ? "user" : "assistant";
    if (turns[index].role !== expected) return null;
  }
  return turns;
}
