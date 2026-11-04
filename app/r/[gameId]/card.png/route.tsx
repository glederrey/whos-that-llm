import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { readFlagImage } from "@/lib/share-card-flag";
import { readModelLogo } from "@/lib/share-card-logo";
import { shareCardHeight, shareCardImage, shareCardWidth } from "@/lib/share-card-image";
import { readShareCard } from "@/lib/share-card-load";
import { shareCardTheme, shareFileName } from "@/lib/share-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let assets: Promise<{ light: string; dark: string; fonts: Font[] }> | undefined;

type Font = { name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" };

// The site fonts are woff2, and some are variable. The card image can only read
// static TrueType or woff files, so these are the same faces in those formats.
const fontFiles: Array<[string, string, Font["weight"]]> = [
  ["Roboto", "roboto-latin-700.ttf", 700],
  ["Instrument Sans", "instrument-sans-latin-500.woff", 500],
  ["Instrument Sans", "instrument-sans-latin-700.woff", 700],
  ["JetBrains Mono", "jetbrains-mono-latin-500.woff", 500],
];

function loadAssets() {
  assets ??= (async () => {
    const [light, dark, ...fonts] = await Promise.all([
      readFile(join(process.cwd(), "public/brand/logo-tail-right-light.png")),
      readFile(join(process.cwd(), "public/brand/logo-tail-right-dark.png")),
      ...fontFiles.map(([, file]) => readFile(join(process.cwd(), "app/fonts", file))),
    ]);
    return {
      light: `data:image/png;base64,${light.toString("base64")}`,
      dark: `data:image/png;base64,${dark.toString("base64")}`,
      fonts: fonts.map((data, index) => ({ name: fontFiles[index][0], data, weight: fontFiles[index][2], style: "normal" as const })),
    };
  })();
  return assets;
}

/** Draws the PNG for this request. The bytes are not written to storage or disk. */
export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const card = await readShareCard(gameId);
  if (!card) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const theme = shareCardTheme(url.searchParams.get("theme"));
  const download = url.searchParams.has("download");
  const [loaded, modelLogo, guessedFlag, actualFlag] = await Promise.all([
    loadAssets(),
    readModelLogo(card.modelLogoPath, theme),
    card.origin?.guessed ? readFlagImage(card.origin.guessed.flag) : null,
    card.origin ? readFlagImage(card.origin.actual.flag) : null,
  ]);
  const logo = theme === "dark" ? loaded.dark : loaded.light;
  return new ImageResponse(shareCardImage(card, logo, modelLogo, theme, { guessed: guessedFlag, actual: actualFlag }), {
    width: shareCardWidth,
    height: shareCardHeight,
    fonts: loaded.fonts,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=600",
      "Content-Disposition": download ? `attachment; filename="${shareFileName(card.id)}"` : "inline",
    },
  });
}
