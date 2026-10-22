import { readFile } from "node:fs/promises";
import path from "node:path";
import { TWEMOJI_CODE } from "@/lib/twemoji";

// Twemoji pictures (@twemoji/svg, CC-BY 4.0) read from node_modules, so there is
// no third-party CDN and no thousands of SVGs in the repo. next.config.ts makes
// sure the files ship with the function.
const DIR = path.join(process.cwd(), "node_modules", "@twemoji", "svg");

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!TWEMOJI_CODE.test(code)) return new Response(null, { status: 404 });
  try {
    const svg = await readFile(path.join(DIR, `${code}.svg`));
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
