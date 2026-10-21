// Copies the company logos from another project's public `logos` bucket into
// the project in .env.development.local, so a fresh dev database shows them.
// It only reads from the source origin (public URLs, no key) and only writes
// to the project whose keys are in .env.development.local.
//
//   npm run db:copy-logos -- https://<source-project>.supabase.co
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { publicImageCacheControl } from "../lib/profile";

const envFile = ".env.development.local";
if (!existsSync(envFile)) {
  console.error(`${envFile} is missing.`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
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

const origin = process.argv[2]?.replace(/\/+$/, "");
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error("Pass the source origin, for example https://<project>.supabase.co");
  process.exit(1);
}
if (origin === url.replace(/\/+$/, "")) {
  console.error("The source is the same project as the target.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const companies = await client.from("companies").select("logo_path");
  if (companies.error) {
    console.error("Could not read the companies. Run the seed first.");
    process.exit(1);
  }
  const models = await client.from("models").select("logo_path").not("logo_path", "is", null);
  if (models.error) {
    console.error("Could not read the models.");
    process.exit(1);
  }

  // logo_path is "logos/<file>"; the file sits at the root of the logos bucket.
  const names = new Set<string>();
  for (const row of [...(companies.data ?? []), ...(models.data ?? [])]) {
    const path = String(row.logo_path ?? "").replace(/^logos\//, "");
    if (path) names.add(path);
  }

  let copied = 0;
  for (const name of names) {
    const response = await fetch(`${origin}/storage/v1/object/public/logos/${encodeURI(name)}`);
    if (!response.ok) {
      console.error(`Could not download ${name} (${response.status}).`);
      process.exit(1);
    }
    const type = response.headers.get("content-type") ?? "application/octet-stream";
    const uploaded = await client.storage.from("logos").upload(name, await response.blob(), {
      upsert: true,
      contentType: type,
      cacheControl: publicImageCacheControl,
    });
    if (uploaded.error) {
      console.error(`Upload failed for ${name}.`);
      process.exit(1);
    }
    copied += 1;
  }

  console.log(`Copied ${copied} logos.`);
}

void main();
