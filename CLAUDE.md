# Who's that LLM?

Next.js (App Router) + Supabase (Postgres, auth) + OpenRouter (model calls via the AI SDK). Deployed on Vercel by `.github/workflows/deploy.yml`.

## Spec first

`docs/` is the source of truth. Start at `docs/README.md`, then open the page for what you are building (`overview`, `rules`, `pages`, `data`, `server`, `admin`, `build`). If the code and a doc disagree, change one of them in the same pass so they match again. The docs are not published on the site.

Game numbers (points, token scale, hint price, no-hint multiplier) live in `lib/config.ts`. A round copies them onto `games.rules` when it starts; editing them never rewrites a game in progress.

## Commands

- `npm run dev`: local server.
- `npm test`: unit tests (`tsx --test`, listed explicitly in `package.json`; add new test files to that list).
- `npm run typecheck`: `tsc --noEmit`. Run it and the tests before calling a change done.

## Rules

- Public repo: no secrets, no real keys in examples, nothing from work.
- Env vars: see `.env.example`. Server-only values stay behind `server-only` modules.
- Database changes go through `supabase/` migrations and must match `docs/data.md`.
