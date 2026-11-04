/** Whole number with a no-break space between thousands: 19 000, -16 000. Every site font has U+00A0. */
export function formatThousands(value: number): string {
  return Math.trunc(value).toLocaleString("en-US").replaceAll(",", " ");
}
