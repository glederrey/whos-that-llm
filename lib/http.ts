import { NextResponse } from "next/server";
import type { ApiFailure } from "./rounds";

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function apiError(failure: ApiFailure) {
  const body: Record<string, unknown> = { error: failure.error };
  if (failure.nextAt) body.nextAt = failure.nextAt;
  if (failure.paused !== undefined) body.paused = failure.paused;
  if (failure.gameId) body.gameId = failure.gameId;
  return apiJson(body, failure.status);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}));
}
