import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { publicImageCacheControl } from "../lib/profile";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")] as const;
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Supabase env is missing.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const logos = ["anthropic.png", "openai.png", "deepseek.png", "mistral.png"];

async function recache(bucket: string, path: string) {
  const downloaded = await client.storage.from(bucket).download(path);
  if (downloaded.error || !downloaded.data) {
    console.error(`Download failed in ${bucket}.`);
    process.exit(1);
  }
  const type = downloaded.data.type || "application/octet-stream";
  const uploaded = await client.storage.from(bucket).upload(path, downloaded.data, {
    upsert: true,
    contentType: type,
    cacheControl: publicImageCacheControl,
  });
  if (uploaded.error) {
    console.error(`Upload failed in ${bucket}.`);
    process.exit(1);
  }
  const purged = await client.storage.from(bucket).purgeCache(path);
  if (purged.error) {
    console.error(`Purge failed in ${bucket}.`);
    process.exit(1);
  }
}

async function main() {
  for (const name of logos) await recache("logos", name);

  const listed = await client.storage.from("avatars").list("", { limit: 1000 });
  if (listed.error) {
    console.error("Could not list avatar folders.");
    process.exit(1);
  }

  let avatars = 0;
  for (const entry of listed.data ?? []) {
    if (!entry.id) {
      const nested = await client.storage.from("avatars").list(entry.name, { limit: 1000 });
      if (nested.error) {
        console.error("Could not list an avatar folder.");
        process.exit(1);
      }
      for (const file of nested.data ?? []) {
        if (!file.id) continue;
        await recache("avatars", `${entry.name}/${file.name}`);
        avatars += 1;
      }
      continue;
    }
    await recache("avatars", entry.name);
    avatars += 1;
  }

  console.log(`Recached ${logos.length} logos and ${avatars} avatars.`);
}

void main();
