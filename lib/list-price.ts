/** OpenRouter quotes a USD price per token. The roster stores dollars per 1M tokens. */
export function dollarsPerMillion(perToken: string): number | null {
  const text = perToken.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const digits = `${whole}${frac}`.replace(/^0+/, "") || "0";
  return roundListPrice(shiftDecimal(digits, 6 - frac.length));
}

export function readListPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPriceInput(value: number | null): string {
  if (value === null) return "";
  return String(value);
}

export function formatListPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  if (value >= 1) return `$${Math.round(value)}`;
  if (value >= 0.1) return `$${value.toFixed(1)}`;
  return `$${value.toFixed(2)}`;
}

function shiftDecimal(digits: string, shift: number): string {
  if (digits === "0") return "0";
  if (shift >= 0) return `${digits}${"0".repeat(shift)}`;
  const point = digits.length + shift;
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

function roundListPrice(decimal: string): number {
  if (decimal === "0" || /^0\.0*$/.test(decimal)) return 0;
  const whole = Number(decimal.split(".")[0]);
  if (whole >= 1) return roundHalfUp(decimal, 0);
  const one = roundHalfUp(decimal, 1);
  if (one > 0) return one;
  const two = roundHalfUp(decimal, 2);
  if (two > 0) return two;
  return roundHalfUp(decimal, 3);
}

function roundHalfUp(decimal: string, digits: number): number {
  const [whole, frac = ""] = decimal.split(".");
  const kept = frac.slice(0, digits);
  const rest = frac.slice(digits);
  const roundUp = rest.length > 0 && rest[0] >= "5";
  if (!roundUp) return Number(digits === 0 ? whole : `${whole}.${kept.padEnd(digits, "0")}`);
  const padded = (kept + "0".repeat(digits)).slice(0, digits);
  const bumped = String(Number(`${whole}${padded}`) + 1).padStart(whole.length + digits, "0");
  if (digits === 0) return Number(bumped);
  const cut = bumped.length - digits;
  return Number(`${bumped.slice(0, cut)}.${bumped.slice(cut)}`);
}
