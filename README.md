<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-tail-right-dark.png">
    <img alt="" src="public/brand/logo-tail-right-light.png" height="56" align="absmiddle">
  </picture>
  Who's that LLM?
</h1>

<p align="center"><b>Who's that Pokémon, but for language models.</b></p>

A hidden model answers you in a chat. You get ten messages to work out who you are talking to: Claude, GPT, DeepSeek, Mistral, something else? Name it early for a bigger score, buy hints if you are stuck, or give up and see the reveal.

Fewer tokens, fewer hints and fewer wrong names mean more points. The exact numbers live in [`lib/config.ts`](lib/config.ts) and the reasoning is in [`docs/rules.md`](docs/rules.md).

## What is in the game

- **All models** and **Daily** rounds. Company, category and Origin modes are built (in Origin you guess where a model comes from, no score). Custom is specified in [`docs/`](docs/README.md) and is coming.
- A leaderboard, a profile page, and a shareable result card for every finished round.
- Hints (company, origin, year, size) that cost points, or a no-hint round that doubles the score.
- An owner-only admin to manage the model roster and watch the OpenRouter bill.

## Stack

Next.js (App Router) · Supabase (Auth, Postgres, Storage) · OpenRouter through the Vercel AI SDK · Vercel.

## Run it locally

You need Node 22 or newer, a free [Supabase](https://supabase.com) project and an [OpenRouter](https://openrouter.ai) key.

1. `npm install`
2. Create a Supabase project for development, then build its database from the migrations: `npx supabase login`, `npx supabase link --project-ref <your-dev-project-ref>`, `npx supabase db push`. The baseline migration creates the tables and the `avatars` and `logos` buckets, and [`supabase/seed.sql`](supabase/seed.sql) fills the roster. Add `--include-seed` to `db push` to load the seed too. `npm run db:copy-logos -- <source project URL>` copies the company logos into your `logos` bucket.
3. Copy [`.env.example`](.env.example) to `.env.development.local` and fill it in with your dev project. Never commit that file.
4. In Supabase Auth, set the site URL and the redirect URLs to the site root, including `http://localhost:3000/`.
5. `npm run dev`, then open <http://localhost:3000>. Sign up, pick a username, start a round.

The app reads three env files, none of them tracked. `npm run dev` loads `.env.development.local` (it overrides `.env.local`). `npm run dev:prod` loads `.env.prod.local` instead, so the local app talks to the production project. Use that one with care.

Database changes follow one flow:

1. `npm run db:new <name>` creates a timestamped file in [`supabase/migrations/`](supabase/migrations/).
2. Write the SQL in it. Never edit a migration that has already been applied; add a new one.
3. `npx supabase db push` applies it to the project you linked (your dev project).
4. Test it with `npm run dev`.

Production changes only on a release: the deploy workflow runs `supabase db push` against the production project, then deploys the app. Nothing reaches production on a push to `main`.

Handy things to know:

- A credit error from OpenRouter pauses the game for everyone. Top up, then set `app_settings.paused` back to `false`.
- The owner account is the one whose Supabase `app_metadata` has `admin: true`. It sees **Admin** in the account menu. For everyone else `/admin` looks like a missing page.
- The app never applies SQL files for you: migrations run with the Supabase CLI, and on production only from the release workflow.

```bash
npm test            # unit tests
npm run typecheck   # tsc --noEmit
```

Run both before opening a pull request.

## Where things live

| Path | What is there |
|---|---|
| [`docs/`](docs/README.md) | The spec. The source of truth for rules, pages, data, server and admin |
| `app/` | Pages and API route handlers. The handlers are the whole backend |
| `lib/` | Game logic, scoring, OpenRouter calls, Supabase clients, and the tests next to them |
| `components/` | React components |
| `supabase/` | Timestamped migrations, the seed and the CLI config |

`lib/game.ts` is the one place that decides a match, a hint or a score. Components render what the server sends and never re-implement the rules.

## Contributing

Anyone is welcome, and nobody pushes straight to `main`. The way in is either:

- **An issue**: a bug, an idea, a model that should be on the roster, a rule that feels unfair. A short description is enough.
- **A pull request**: fork, branch, change, open the PR. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the short checklist.

## Working with an AI coding agent

This repo is set up for agents as well as humans. Point yours at these, in order:

1. [`CLAUDE.md`](CLAUDE.md): commands, rules and pitfalls.
2. [`docs/README.md`](docs/README.md): the spec. If the code and a doc disagree, change one of them in the same pass so they match again.
3. [`lib/config.ts`](lib/config.ts): every game number. A round copies them onto `games.rules` when it starts, so editing them never rewrites a game in progress.

Ground rules for agents and humans alike: no secrets or real keys anywhere in the repo, server-only values stay behind `server-only` modules, database changes go through `supabase/` and must match [`docs/data.md`](docs/data.md), and new test files must be added to the `test` script in `package.json`.

## License

This project is released under the [MIT License](LICENSE). You are free to use, copy, modify and share it, as long as the copyright notice and the license text stay with it. The software comes as is, without warranty.

## Credits

Emoji icons are drawn with [Twemoji](https://github.com/jdecked/twemoji) graphics (`@twemoji/svg`), copyright 2020 Twitter, Inc and other contributors, licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). They are served from this site, not from a CDN.
