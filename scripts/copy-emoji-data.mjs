// Copies the emoji data for the admin emoji picker into public/, so the picker
// loads it from our origin and never from a third-party CDN. Re-run after
// bumping emoji-picker-element-data.
//   npm run emoji:copy
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/emoji-data", { recursive: true });
copyFileSync("node_modules/emoji-picker-element-data/en/emojibase/data.json", "public/emoji-data/en.json");
