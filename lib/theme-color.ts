export type Theme = "light" | "dark";

export const themeColors: Record<Theme, string> = { light: "#e6e1d8", dark: "#141414" };

// The layout ships one theme-color tag per OS scheme. Once the player picks a theme by hand, that choice wins:
// the tags lose their media query and all take the chosen color.
export function applyThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.removeAttribute("media");
    meta.setAttribute("content", themeColors[theme]);
  }
}
