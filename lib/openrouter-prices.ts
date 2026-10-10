export type ModelPrice = {
  prompt: string | null;
  completion: string | null;
};

const catalogUrl = "https://openrouter.ai/api/v1/models";

export function perMillionLabel(perToken: unknown): string | null {
  if (typeof perToken !== "string" && typeof perToken !== "number") return null;
  if (typeof perToken === "string" && perToken.trim() === "") return null;
  const value = typeof perToken === "number" ? perToken : Number(perToken.trim());
  if (!Number.isFinite(value) || value < 0) return null;
  const perMillion = value * 1_000_000;
  if (perMillion === 0) return "$0";
  if (perMillion >= 0.01) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(6).replace(/0+$/, "")}`;
}

export function pricesById(payload: unknown): Map<string, ModelPrice> | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const prices = new Map<string, ModelPrice>();
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0) continue;
    const pricing = (row as { pricing?: unknown }).pricing;
    const prompt = pricing && typeof pricing === "object" ? (pricing as { prompt?: unknown }).prompt : null;
    const completion = pricing && typeof pricing === "object" ? (pricing as { completion?: unknown }).completion : null;
    prices.set(id, { prompt: perMillionLabel(prompt), completion: perMillionLabel(completion) });
  }
  return prices;
}

export async function fetchPublicModelPrices(): Promise<Map<string, ModelPrice> | null> {
  try {
    const response = await fetch(catalogUrl, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return pricesById(await response.json());
  } catch {
    return null;
  }
}
