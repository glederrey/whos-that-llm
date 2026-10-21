// Runs `next dev` against the production project: loads .env.prod.local into
// the environment first. Next never overrides a variable that is already set,
// so these values win over .env.development.local and .env.local.
//   npm run dev:prod
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const file = ".env.prod.local";
if (!existsSync(file)) {
  console.error(`${file} is missing.`);
  process.exit(1);
}
process.loadEnvFile(file);

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
next.on("exit", (code) => process.exit(code ?? 0));
