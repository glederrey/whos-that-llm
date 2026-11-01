import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "node_modules", "@lobehub", "icons-static-svg", "icons");
const variants = /-(text|text-cn|brand|brand-color)$/;

let cached: Promise<string[]> | null = null;

/** Icon ids the picker offers: the plain icon and its `-color` version. Text and brand variants are left out. */
export function listLobeIds(): Promise<string[]> {
  cached ??= readdir(dir)
    .then((files) =>
      files
        .filter((file) => file.endsWith(".svg"))
        .map((file) => file.slice(0, -4))
        .filter((id) => !variants.test(id))
        .sort(),
    )
    .catch(() => []);
  return cached;
}

export async function readLobeSvg(id: string): Promise<string | null> {
  if (!(await listLobeIds()).includes(id)) return null;
  try {
    return await readFile(path.join(dir, `${id}.svg`), "utf8");
  } catch {
    return null;
  }
}
