import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { readModelLogo } from "@/lib/share-card-logo";
import { shareCardHeight, shareCardImage, shareCardWidth } from "@/lib/share-card-image";
import { readShareCard } from "@/lib/share-card-load";
import { shareFileName } from "@/lib/share-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let assets: Promise<{ logo: string; regular: Buffer; bold: Buffer }> | undefined;

function loadAssets() {
  // The site fonts are woff2, and the regular cut is a variable font. The card
  // image can only read a static TrueType file, so these are those same faces.
  assets ??= (async () => {
    const [logo, regular, bold] = await Promise.all([
      readFile(join(process.cwd(), "public/brand/logo-tail-right-light.png")),
      readFile(join(process.cwd(), "app/fonts/roboto-latin-400.ttf")),
      readFile(join(process.cwd(), "app/fonts/roboto-latin-700.ttf")),
    ]);
    return {
      logo: `data:image/png;base64,${logo.toString("base64")}`,
      regular,
      bold,
    };
  })();
  return assets;
}

/** Draws the PNG for this request. The bytes are not written to storage or disk. */
export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const card = await readShareCard(gameId);
  if (!card) return new Response(null, { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  const [{ logo, regular, bold }, modelLogo] = await Promise.all([loadAssets(), readModelLogo(card.modelLogoPath)]);
  return new ImageResponse(shareCardImage(card, logo, modelLogo), {
    width: shareCardWidth,
    height: shareCardHeight,
    fonts: [
      { name: "Roboto", data: regular, weight: 400, style: "normal" },
      { name: "Roboto", data: bold, weight: 700, style: "normal" },
    ],
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": download ? `attachment; filename="${shareFileName(card.id)}"` : "inline",
    },
  });
}
