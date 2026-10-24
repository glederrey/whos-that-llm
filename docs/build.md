# Build

This page covers the repo layout, the env, the config numbers, the seed roster, and the checks. Do not publish this spec as a site page.

## Layout

```
app/
  page.tsx, layout.tsx          landing (with the weekly top 5), and the return target for email links
  not-found.tsx, robots.ts, sitemap.ts, apple-icon.png, globals.css, fonts/
  login/, welcome/, reset-password/, profile/
  account/delete/               delete-account action
  auth/actions.ts               sign in, sign up, sign out
  play/page.tsx                 lobby
  play/[gameId]/page.tsx        round
  play/[gameId]/result/page.tsx
  r/[gameId]/                   shared result page, and card.png for its image
  leaderboard/, statistics/, scoring/, why/
  emoji/[code]/                 Twemoji SVG route
  admin/                        owner pages: costs, modes, categories, companies, origins, models, providers, chat (+ chat/send), actions.ts
  api/                          the routes in Server
lib/
  config.ts                     the numbers, imported by POST /api/games
  prompt.ts                     the system prompt
  game.ts                       pool, frozen traits, filter, compare, score
  game-labels.ts                the words around a round: origin, size and pool labels, the score explanation
  rounds.ts                     barrel: the one import for everything below
  rounds-shape.ts               pure: row mappers, failures, transcript and guess shaping
  rounds-score.ts               pure: guess finish and the inputs to scoreRound
  rounds-board-rows.ts          pure: leaderboard rows, filters, public stats parsing
  rounds-queries.ts             reads and rpc calls that take the client as an argument
  rounds-start.ts               game modes, lobby, starting a round
  rounds-play.ts                reading a round, claim, reply, guess, hint, give up
  rounds-board.ts, rounds-user.ts  leaderboard and landing counts, username
  board-query.ts, board-seed.ts leaderboard choice (mode, period, difficulty) and the avatar seed
  public-stats*.ts              figures for the statistics page
  openrouter*.ts                the streaming call, usage, spend, catalog, providers
  admin-*.ts                    owner-page data and checks
  share-card*.ts, site.ts       share card and the site origin
  session.ts, http.ts           current user, JSON and error helpers
  supabase/                     env, session client and service-role client
components/                     round board, hints, guess bar, transcript, markdown message, theme toggle, footer, admin panels
  round-board.tsx               the round screen. State and requests live in use-round.ts
  use-round.ts, use-guess-fit.ts  the round hook, and the sizing of the previous guesses card
proxy.ts                        session refresh on every request
next.config.ts                  security headers
public/brand/, public/emoji-data/  site logo copies and Twemoji data. tail_right when the text is on the right, tail_left when it is on the left
logo/                           source logos
scripts/                        copy-logos, cache-public-images, copy-emoji-data, dev-prod, reset and placeholder helpers
supabase/migrations/            timestamped SQL for the tables in Data, run by the Supabase CLI
supabase/seed.sql               catalog snapshot loaded by `supabase db reset`
supabase/templates/             the two auth emails
.github/workflows/              ci.yml, db-dry-run.yml, deploy.yml
```

There is no `rules/page.tsx`. The game lives under `/play`, and `/profile` is the player's page.

`lib/game.ts` is the only place that decides a match, a hint, a filter, or a score. Routes load rows and call it. Components render the public object and do not reimplement the rules. `lib/game-labels.ts` only words what `game.ts` decided.

Import server code from `@/lib/rounds`. The `rounds-*` files behind it are an implementation detail: the pure ones have unit tests with no database, and `rounds-queries.ts` takes the Supabase client as an argument so a test can pass a small fake. The previous guesses card shrinks to fit between the writing box and the window; when a short thread leaves it under 120px, it uses the window bottom instead (`components/use-guess-fit.ts`).

`lib/config.ts` exports the object stored on `games.rules`, plus `hourlyCap: 20` and `tipUrl`. Category flags (`leaderboard`, `hints_allowed`, `enabled`) are seeded into `categories`. A round copies `hintsAllowed` off the category row and the numbers off config, then freezes traits, so an admin edit does not rewrite a game in progress.

```ts
{
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 2000,
  modelBase: 2000,
  originPoints: 100,
  companyPoints: 300,
  tokenScale: 10000,
  tokenCap: 20,
  hintCosts: { year: 100, size: 100, origin: 400, company: 600 },
  difficultyMultipliers: { easy: 0.5, medium: 1, hard: 2, impossible: 3 },
  wrongGuessCost: 100,
  noHintMultiplier: 2,
  hourlyCap: 20,
  tipUrl: "https://ko-fi.com/glederrey"
}
```

`tokenScale` is the 10,000 in `min(tokenCap, tokenScale / tokens)`. `tokenCap` is 20, so 500 tokens or fewer, including 0, is ×20, and 10,000 tokens is ×1. Past that the factor is below 1. `modelBase` is the 2000 for naming the model. Do not add another cap in code. `tipUrl` is the Ko-fi page. Empty hides the footer link. The Cursor credit is not config. It is the footer specified in [Pages](pages.md).

## Env

| Name | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. The publishable key |
| `SUPABASE_SECRET_KEY` | Server only. The secret key. Bypasses row level security |
| `OPENROUTER_API_KEY` | Server only |
| `OPENROUTER_MANAGEMENT_KEY` | Server only. Reads spend for `/admin/costs`. Falls back to the API key. Also a `deploy.yml` secret |
| `AVAILABILITY_TOKEN` | Server only. Guards `/api/admin/availability` |

Those names live in untracked env files at the repo root: `.env.development.local` (dev project, loaded by `npm run dev`), `.env.prod.local` (production, loaded by `npm run dev:prod`), and `.env.local` as the shared default. Comments in the file do not matter. The values stay in that file: do not open it to check them, and do not copy them into docs, chat, or git. The file stays untracked. Vercel gets the same names. The secret key and the OpenRouter key are sensitive. Do not prefix `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_`. Admin is `app_metadata.admin === true` on the signed-in user, not an env var.

In Supabase, set the site URL to the site root (each project: production, and `http://localhost:3000` for dev). Confirmation returns to the main page.

The two auth emails are custom, in `supabase/templates/`. Supabase does not read them from the repo: paste each file into Authentication → Emails → Templates on both projects, and set the subject. `confirm-signup.html` goes in **Confirm sign up** (subject: `Confirm your email`). `reset-password.html` goes in **Reset Password** (subject: `Reset your password`).

The reset template is not cosmetic. Its link is `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`, so opening it signs nobody in before the new password is chosen. The default `{{ .ConfirmationURL }}` signs the visitor in on arrival and must not stay.

## Seed roster

[`supabase/seed.sql`](../supabase/seed.sql) is a snapshot of the production catalog: about 145 models from 11 companies, nearly all enabled. A few rows are seeded off (the Fable rows, for cost) and a few old Anthropic rows are unavailable. The seed also inserts two categories (Opus and Sonnet), the OpenRouter provider slugs, and `app_settings` with `paused = false`. Prices are not stored, and billing uses `usage.cost_usd`. All models can draw any enabled model.

Verify every slug on OpenRouter before enabling a new one, and set `released_on` first. The owner adds, edits, and disables models in `/admin/models`.

The reasoning setting is an admin fact for `provider_settings` and for cost. It is not a chip. For each reasoning model, start with `{ "reasoning": { "effort": "low" } }`. Play one round of each new model. If `reasoning_tokens` stays high, set that model back to `enabled = false` and change the object before turning it on again.

Labels on screen are USA, China, and Europe. Company logos are the PNG files in the Supabase `logos` bucket.

The seed inserts missing ids and does not update a row whose `updated_at` is newer than the seed file. Admin edits survive a re-seed. Built-in categories get `sort_order` in the order of the blurb table in [Pages](pages.md). Seed leaderboard and hint flags as in [Data](data.md).

## Checks

Run `npm run typecheck` and `npm test` before calling a change done. A round must not let the hidden model name itself, an empty successful reply still spends the message, and the total is never below 0. The token factor's only cap is `tokenCap`. A credit error sets `app_settings.paused`: after topping up on OpenRouter, clear it in the database. A GitHub Release deploys the release tag to Vercel.

## Security headers and CI

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, and a Content-Security-Policy on every route. HSTS is not set here: Vercel sends it on its own, and a header from the app would make browsers force HTTPS on `localhost` during development. `script-src` is `'self' 'unsafe-inline'`, because Next streams inline bootstrap scripts and the theme snippet is inline; nonces would make every page dynamic. `connect-src` allows the Supabase origin. Images may come from any `https:` host (Supabase storage, mostly). Model replies never render images. There is no `form-action`, since sign-in forms redirect to Google and Supabase.

`.github/workflows/ci.yml` runs typecheck and tests on pull requests and on pushes to `main`, plus a `migrations` job that replays every migration and the seed on a fresh local Supabase stack (`supabase db reset`). That job touches no real project. Real databases migrate elsewhere: production only from `deploy.yml` on a release (it previews, then applies), and the dev project by hand. `db-dry-run.yml` is a manual check of the production secret that previews pending migrations and changes nothing. `deploy.yml` pins the Vercel CLI and the actions, and gives the Vercel secrets only to the steps that call it. Dependabot proposes weekly npm and Actions updates, grouped by minor and patch.
