import { readLobeSvg } from "@/lib/lobe-logo-files";

// Company logos from @lobehub/icons-static-svg (MIT), read from node_modules like the Twemoji pictures.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.svg$/.exec(file);
  const svg = match ? await readLobeSvg(match[1]) : null;
  if (!svg) return new Response(null, { status: 404 });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
