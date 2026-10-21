# Contributing

Thanks for helping. Direct pushes to `main` are not possible: everything goes through an issue or a pull request.

## Issues

Open one for a bug, an idea, or a model you would like to see. For a bug, say what you did, what happened and what you expected. Do not paste keys or tokens.

Security problems go through GitHub's private vulnerability reporting (Security tab), not a public issue.

## Pull requests

1. Fork the repo and branch from `main`.
2. Read the page in [`docs/`](docs/README.md) for the thing you are changing. The docs are the spec. If your change makes the code and a doc disagree, update both in the same PR.
3. Keep the diff small and on one subject.
4. Run `npm run typecheck` and `npm test`. A new test file must be added to the `test` script in `package.json`.
5. A database change is a migration under `supabase/` that also matches [`docs/data.md`](docs/data.md).
6. Open the PR and say what changed and why.

## Rules for everything in this repo

- It is public. No secrets, no real keys in examples, no private data.
- Game numbers live in `lib/config.ts`. Do not hard-code them elsewhere.
- Server-only values stay behind `server-only` modules.
