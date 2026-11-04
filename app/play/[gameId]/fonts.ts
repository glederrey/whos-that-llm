import localFont from "next/font/local";

// Round redesign trial: the three faces of the new design system, vendored like Roboto.
export const displayFont = localFont({
  src: "../../fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-display",
});
export const uiFont = localFont({
  src: "../../fonts/instrument-sans-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-ui",
});
export const monoFont = localFont({
  src: "../../fonts/jetbrains-mono-latin-500.woff2",
  weight: "500",
  display: "swap",
  variable: "--font-mono",
});
