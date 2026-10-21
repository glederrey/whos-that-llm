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

- **All models** and **Daily** rounds. Company, region, custom and class modes are specified in [`docs/`](docs/README.md) and are coming.
- A leaderboard, a profile page, and a shareable result card for every finished round.
- Hints (company, region, year, size) that cost points, or a no-hint round that doubles the score.
- An owner-only admin to manage the model roster and watch the OpenRouter bill.

## Stack

Next.js (App Router) · Supabase (Auth, Postgres, Storage) · OpenRouter through the Vercel AI SDK · Vercel.

## Run it locally

You need Node 22 or newer, a free [Supabase](https://supabase.com) project and an [OpenRouter](https://openrouter.ai) key.

1. `npm install`
2. Create the database. In the Supabase SQL editor, run [`supabase/v0.4.sql`](supabase/v0.4.sql) once. It is the baseline for a fresh project and already includes every migration up to `0038`. Do not run the files in [`supabase/migrations/`](supabase/migrations/) after it.
3. Copy [`.env.example`](.env.example) to `.env.local` and fill it in. Never commit that file.
4. In Supabase Auth, set the site URL and the redirect URLs to the site root, including `http://localhost:3000/`.
5. `npm run dev`, then open <http://localhost:3000>. Sign up, pick a username, start a round.

Handy things to know:

- A credit error from OpenRouter pauses the game for everyone. Top up, then set `app_settings.paused` back to `false`.
- The owner account is the one whose Supabase `app_metadata` has `admin: true`. It sees **Admin** in the account menu. For everyone else `/admin` looks like a missing page.
- The app never applies SQL files for you.

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
| `supabase/` | Database baseline and migrations |

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
