import { lobeSvgForTheme, parseLobeTheme } from "@/lib/lobe-logo";
import { readLobeSvg } from "@/lib/lobe-logo-files";

// Company logos from @lobehub/icons-static-svg (MIT), read from node_modules like the Twemoji pictures.
// ?theme=dark gives the version that shows on the dark theme, anything else the light one.
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.svg$/.exec(file);
  const svg = match ? await readLobeSvg(match[1]) : null;
  if (!svg) return new Response(null, { status: 404 });
  const theme = parseLobeTheme(new URL(request.url).searchParams.get("theme"));
  return new Response(lobeSvgForTheme(svg, theme), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
