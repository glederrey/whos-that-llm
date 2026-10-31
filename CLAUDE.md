# Who's that LLM?

Next.js (App Router) + Supabase (Postgres, auth) + OpenRouter (model calls via the AI SDK). Deployed on Vercel by `.github/workflows/deploy.yml`.

## Spec first

`docs/` is the source of truth. Start at `docs/README.md`, then open the page for what you are building (`overview`, `rules`, `pages`, `data`, `server`, `admin`, `build`). If the code and a doc disagree, change one of them in the same pass so they match again. The docs are not published on the site.

Game numbers (points, token scale, hint price, no-hint multiplier) live in `lib/config.ts`. A round copies them onto `games.rules` when it starts; editing them never rewrites a game in progress.

## Commands

- `npm run dev`: local server.
- `npm test`: unit tests (`tsx --test "lib/**/*.test.ts"`; any new `lib/**/*.test.ts` file is picked up).
- `npm run typecheck`: `tsc --noEmit`. Run it and the tests before calling a change done.

## Rules

- Public repo: no secrets, no real keys in examples, nothing from work.
- Env vars: see `.env.example`. Server-only values stay behind `server-only` modules.
- Database changes are a new timestamped file in `supabase/migrations/` (`npm run db:new <name>`) and must match `docs/data.md`. Never edit a migration that was already applied. A new table gets its explicit `GRANT` and its RLS in the same file. Production migrates only from `deploy.yml` on a release; never run a write against the production project by hand.
- `npm run dev` uses `.env.development.local` (dev project); `npm run dev:prod` uses `.env.prod.local` (production). The old numbered migrations are gone: `20261021080000_baseline.sql` is the whole schema up to that date.

## UI work

- Visual reference: `DESIGN.md` (tokens, layout, do's and don'ts) and `PRODUCT.md` (users, principles). Change them in the same pass as the code.
- For any UI change, use the web skills: `impeccable` (critique, polish, detector), `frontend-design`, `emil-design-eng`, `mobile-native`, `break-ui`, `web-design-guidelines`, and `webapp-testing` (Playwright) for screenshots. Check phone (390px) and desktop (1280px), light and dark.
- The dev server normally runs on `localhost:3000` (`npm run dev`, dev Supabase project). Check it before starting another.
- Admin pages (`/admin/*`) are used on a computer only; they do not need to work on a phone. To sign in, read the admin login from `.env.development.local` (the admin email and password variables) inside a script. Never print the values, and never write the variable name for the email in a tracked file: `lib/admin-surface.test.ts` fails on it.
- Screenshots and scratch files go outside the repo, never in a commit.
