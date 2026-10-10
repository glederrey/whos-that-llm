import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REDACTED = "[SENSITIVE]";

const rootEnvFiles = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
];

function unquote(raw) {
  const value = raw.trim().replace(/\r$/, "");
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

export function stripPlaceholderText(text) {
  const removed = [];
  const kept = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && unquote(match[2]) === REDACTED) {
      removed.push(match[1]);
      continue;
    }
    kept.push(line);
  }
  let next = kept.join("\n");
  if (text.endsWith("\n") && next !== "" && !next.endsWith("\n")) next += "\n";
  if (!text.endsWith("\n")) next = next.replace(/\n$/, "");
  return { text: next, removed };
}

function vercelEnvFiles(root) {
  const dir = join(root, ".vercel");
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith(".env.") && name.endsWith(".local"))
    .map((name) => join(".vercel", name));
}

export function stripSensitivePlaceholders(root) {
  const targets = [...new Set([...vercelEnvFiles(root), ...rootEnvFiles])];
  const removed = [];
  for (const relative of targets) {
    const path = join(root, relative);
    let text;
    try {
      if (!statSync(path).isFile()) continue;
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const result = stripPlaceholderText(text);
    if (result.removed.length === 0) continue;
    writeFileSync(path, result.text);
    for (const name of result.removed) removed.push({ file: relative, name });
  }
  return removed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const removed = stripSensitivePlaceholders(process.cwd());
  for (const item of removed) {
    console.log(`Removed redacted placeholder for ${item.name} from ${item.file}`);
  }
}
