# Contributing

Thanks for helping. Direct pushes to `main` are not possible: everything goes through an issue or a pull request.

## Issues

Open one for a bug, an idea, or a model you would like to see. For a bug, say what you did, what happened and what you expected. Do not paste keys or tokens.

## Pull requests

1. Fork the repo and branch from `main`.
2. Read the page in [`docs/`](docs/README.md) for the thing you are changing. The docs are the spec. If your change makes the code and a doc disagree, update both in the same PR.
3. Keep the diff small and on one subject.
4. Run `npm run typecheck` and `npm test`. A new test file must be added to the `test` script in `package.json`.
5. A database change is a new timestamped migration (`npm run db:new <name>`) under `supabase/migrations/` that also matches [`docs/data.md`](docs/data.md). Never edit a migration that has already been applied. A new table gets its explicit `GRANT` and its row level security policies in the same file: from 30 Oct 2026 Supabase no longer grants new tables to the API roles. CI replays every migration and the seed on a fresh database.
6. Open the PR and say what changed and why.

## Rules for everything in this repo

- It is public. No secrets, no real keys in examples, no private data.
- Game numbers live in `lib/config.ts`. Do not hard-code them elsewhere.
- Server-only values stay behind `server-only` modules.
