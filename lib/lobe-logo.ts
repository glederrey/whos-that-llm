/** A company logo that ships with the app (`@lobehub/icons-static-svg`) instead of living in the logos bucket. */
export const lobePrefix = "lobe:";

const lobeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isLobePath(path: string): boolean {
  return path.startsWith(lobePrefix);
}

/** The icon id of a stored `lobe:` path, or null when it is not one or is malformed. */
export function lobeIdOf(path: string): string | null {
  if (!isLobePath(path)) return null;
  const id = path.slice(lobePrefix.length);
  return lobeId.test(id) ? id : null;
}

export function lobePath(id: string): string {
  return `${lobePrefix}${id}`;
}

/** The public URL the app serves the icon from (`app/lobe/[file]/route.ts`). */
export function lobeUrl(id: string): string {
  return `/lobe/${id}.svg`;
}

export type LobeTheme = "light" | "dark";

export function parseLobeTheme(value: string | null | undefined): LobeTheme {
  return value === "dark" ? "dark" : "light";
}

/** The URL for one theme. A page draws the light one and the dark one and CSS shows the right one. */
export function lobeThemeUrl(id: string, theme: LobeTheme): string {
  return `${lobeUrl(id)}?theme=${theme}`;
}

/** Text colours the logos take, matching the card and page text. */
const themeInk: Record<LobeTheme, string> = { light: "#111111", dark: "#f5f5f5" };

const paint = /((?:fill|stroke|stop-color)(?:="|:\s*))([^";}]+)/g;

type Rgb = [number, number, number];

function parseColor(value: string): Rgb | "skip" | "unknown" {
  const text = value.trim().toLowerCase();
  if (text === "none" || text === "currentcolor" || text.startsWith("url(") || text === "transparent" || text === "inherit") return "skip";
  if (text === "white") return [255, 255, 255];
  if (text === "black") return [0, 0, 0];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (!hex) return "unknown";
  const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
  return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)) as Rgb;
}

const lightness = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const isGrey = ([r, g, b]: Rgb) => Math.max(r, g, b) - Math.min(r, g, b) <= 12;
const hexOf = ([r, g, b]: Rgb) => `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;

/**
 * The SVG as it should look on one theme.
 * `currentColor` takes the theme's text colour. A logo that is only black, white and greys is flipped
 * when it would vanish on the theme's background: all dark on dark, all light on light. A logo with
 * real colours is left alone, because its white or black parts are usually drawn on a coloured shape.
 */
export function lobeSvgForTheme(svg: string, theme: LobeTheme): string {
  const colors: Rgb[] = [];
  let unknown = false;
  for (const match of svg.matchAll(paint)) {
    const color = parseColor(match[2]);
    if (color === "unknown") unknown = true;
    else if (color !== "skip") colors.push(color);
  }
  let flip = false;
  if (!unknown && colors.length > 0 && colors.every(isGrey)) {
    flip = theme === "dark" ? colors.every((color) => lightness(color) < 0.35) : colors.every((color) => lightness(color) > 0.65);
  }
  const painted = flip
    ? svg.replace(paint, (whole, head: string, value: string) => {
        const color = parseColor(value);
        return Array.isArray(color) ? `${head}${hexOf([255 - color[0], 255 - color[1], 255 - color[2]])}` : whole;
      })
    : svg;
  return painted.replaceAll(/currentcolor/gi, themeInk[theme]);
}
