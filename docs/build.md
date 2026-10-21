# Build

**All models** is the first build. Auth, one round, hints, no-hint mode, the score, the result page, and the profile. The other categories, the weekly top 5, daily stats, and admin come later. Do not publish this spec as a site page.

## Layout

```
app/
  page.tsx                      landing, and the return target for email links
  login/page.tsx
  welcome/page.tsx
  play/page.tsx                 lobby
  play/new/page.tsx             pool picker, later
  play/[gameId]/page.tsx        round
  play/[gameId]/result/page.tsx
  leaderboard/page.tsx
  admin/                        later, the pages in Admin
  api/                          the routes in Server
lib/
  config.ts                     the numbers, imported by POST /api/games
  prompt.ts                     the system prompt
  game.ts                       pool, frozen traits, filter, compare, score
  openrouter.ts                 one streaming call, usage parsed out
  supabase/server.ts            session client and service-role client
components/                     feedback, hints, guess bar, transcript, theme toggle, footer
app/globals.css                 light and dark tokens. Default follows the system
public/brand/                   site logo copies. tail_right when the text is on the right, tail_left when it is on the left
supabase/migrations/            timestamped SQL for the tables in Data, run by the Supabase CLI
supabase/seed.sql               catalog snapshot loaded by `supabase db reset`
```

There is no `rules/page.tsx`. There is no `me/page.tsx` in the first build.

`lib/game.ts` is the only place that decides a match, a hint, a filter, or a score. Routes load rows and call it. Components render the public object and do not reimplement the rules.

`lib/config.ts` exports the object stored on `games.rules`, plus `hourlyCap: 20` and `tipUrl`. Category flags (`leaderboard`, `hints_allowed`, `enabled`) are seeded into `categories`. A round copies `hintsAllowed` off the category row and the numbers off config, then freezes traits, so an admin edit does not rewrite a game in progress.

```ts
{
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 2000,
  modelBase: 2000,
  regionPoints: 100,
  companyPoints: 300,
  tokenScale: 10000,
  tokenCap: 20,
  hintCosts: { year: 100, size: 100, region: 400, company: 600 },
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

Those four names live in untracked env files at the repo root: `.env.development.local` (dev project, loaded by `npm run dev`), `.env.prod.local` (production, loaded by `npm run dev:prod`), and `.env.local` as the shared default. Comments in the file do not matter. The values stay in that file: do not open it to check them, and do not copy them into docs, chat, or git. The file stays untracked. Vercel gets the same names. The secret key and the OpenRouter key are sensitive. Do not prefix `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_`. Admin is `app_metadata.admin === true` on the signed-in user, not an env var.

In Supabase, set the site URL and the email redirect URLs to the site root `/`, so confirmation and password reset return to the main page.

## First roster

Verify every slug on OpenRouter before enabling it. Prices and dates below are for seeding, not for billing. Billing uses `usage.cost_usd`. All models can draw any enabled model.

The prototype turns on six small models and leaves every other row disabled. The owner can change that roster from `/admin/models`. This seed is the roster you can try:

- Claude Haiku 4.5 (`claude-haiku-4-5`)
- Claude Haiku 5.5 (`claude-haiku-5-5`)
- GPT-5.6 Luna (`gpt-5-6-luna`)
- GPT-5.6 Luna Pro (`gpt-5-6-luna-pro`)
- GPT-6 Luna (`gpt-6-luna`)
- DeepSeek V4 Flash (`deepseek-v4-flash`)

That pool has three companies and two regions, USA and China, so a guess can hit or miss both point traits. A wrong name can now stay inside Anthropic or OpenAI. OpenRouter has no other small Anthropic model, so Haiku 4.5 is the only extra Anthropic row. A full round on Haiku 5.5, the Lunas, or Flash is under about 1 cent. Haiku 4.5 is a few cents. More models wait until admin exists.

Slugs checked against public listings in October 2026. Re-check on the day of the seed. `released_on` is required before enable, and several of these dates still need to be copied off the model page.

| Our id | OpenRouter id | Company | Size | Reasoning | Notes |
|---|---|---|---|---|---|
| `claude-opus-4-8` | `anthropic/claude-opus-4.8` | Anthropic | large | yes | Pair with Opus 5.5 |
| `claude-opus-5-5` | `anthropic/claude-opus-5.5` | Anthropic | large | yes | Confirm the slug. Expensive. |
| `claude-sonnet-5` | `anthropic/claude-sonnet-5` | Anthropic | medium | yes | |
| `claude-sonnet-5-5` | `anthropic/claude-sonnet-5.5` | Anthropic | medium | yes | Released 2026-09-28. |
| `claude-haiku-4-5` | `anthropic/claude-haiku-4.5` | Anthropic | small | yes | Starts enabled. Released 2025-10-15. The only other small Anthropic id on OpenRouter. $1 / $5 per million tokens |
| `claude-haiku-5-5` | `anthropic/claude-haiku-5.5` | Anthropic | small | yes | Starts enabled. Released 2026-10-07. |
| `gpt-5-6-luna` | `openai/gpt-5.6-luna` | OpenAI | small | yes | Starts enabled |
| `gpt-5-6-luna-pro` | `openai/gpt-5.6-luna-pro` | OpenAI | small | yes | Starts enabled. Released 2026-07-09. Same list price as GPT-5.6 Luna |
| `gpt-6-luna` | `openai/gpt-6-luna` | OpenAI | small | yes | Starts enabled. Released 2026-09-22. $0.10 / $0.50 per million tokens |
| `gpt-5-6-sol` | `openai/gpt-5.6-sol` | OpenAI | medium | yes | |
| `gpt-5-6-terra` | `openai/gpt-5.6-terra` | OpenAI | large | yes | |
| `deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | DeepSeek | small | yes | Starts enabled. China. Open weights is an admin fact. Confirm it on the model page. Play does not use it |
| `deepseek-v4-pro` | `deepseek/deepseek-v4-pro` | DeepSeek | large | yes | |
| `mistral-medium-3-5` | `mistralai/mistral-medium-3-5` | Mistral | medium | confirm | Europe |
| `mistral-large-2512` | `mistralai/mistral-large-2512` | Mistral | large | confirm | |

Leave Fable out. The Reasoning column is an admin fact for `provider_settings` and for cost. It is not a chip. For each reasoning model, the seed starts with `{ "reasoning": { "effort": "low" } }`. Play one round of each enabled model. If `reasoning_tokens` stays high, set that model back to `enabled = false` and change the object before turning it on again.

Companies to insert first: Anthropic `us`, OpenAI `us`, DeepSeek `cn`, Mistral `eu`. Labels on screen are USA, China, and Europe. Company logos are the PNG files in the Supabase `logos` bucket.

The seed script inserts missing ids and does not update a row whose `updated_at` is newer than the seed file. Admin edits survive a re-seed. Built-in categories get `sort_order` in the order of the blurb table in [Pages](pages.md). Seed All models enabled. Seed the other categories disabled. Seed leaderboard and hint flags as in [Data](data.md).

## Order

The first build is a playable All models round. Gael plays it locally, then the other categories.

1. Migration from [Data](data.md). Seed the roster. Enable Haiku 4.5, Haiku 5.5, GPT-5.6 Luna, GPT-5.6 Luna Pro, GPT-6 Luna, and DeepSeek V4 Flash. Leave every other company disabled. Seed All models enabled as a category, and the other categories disabled.
2. App shell: landing page, login, welcome, footer, theme. Email links return to `/`. A session is required before `/play`.
3. `lib/openrouter.ts` and `lib/prompt.ts`. Stream the reply word by word. Play one round on Haiku. Read `reasoning_tokens` and the transcript. Confirm it does not name itself. Confirm an empty successful reply still spends the message.
4. `lib/game.ts`: frozen traits, server-filtered guess list, compare, hints, no-hint mode, score. All models, ten messages, a guess the player can skip, give up. The result page shows the breakdown and links to How scoring works. The total is never below 0. Play across the enabled models.
5. The hourly cap and one active round. A credit error sets `app_settings.paused` for everyone.
6. Leaderboard for All models: rank, name, best score.
7. Later: daily, company, region, custom, and class. They are pool filters plus the given-trait rule. Custom is a choice of models, hints can be on, and it has no leaderboard. Class is not built. Hints are only on Daily, All models, and Custom. There is no Latest category and no Origin category. `models.is_latest` is dropped.
8. Later: home weekly top 5 and daily result stats. The profile, with stats, past games, and username changes, is in this prototype.
9. Later: admin. Spend, stats, roster, logos in Supabase Storage with a URL fallback, pause switch, recent rounds.
10. Publish a GitHub Release. That deploys the release tag to the `*.vercel.app` URL. A domain comes after someone besides us is playing.

Step 4 is allowed to set models `enabled = false`. It is not allowed to add a mechanic that is not in [Rules](rules.md). The token factor's only cap is `tokenCap`. If a credit error pauses the game before the admin page exists, clear `app_settings.paused` after topping up on OpenRouter.

## Security headers and CI

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, and a Content-Security-Policy on every route. HSTS is not set here: Vercel sends it on its own, and a header from the app would make browsers force HTTPS on `localhost` during development. `script-src` is `'self' 'unsafe-inline'`, because Next streams inline bootstrap scripts and the theme snippet is inline; nonces would make every page dynamic. `connect-src` allows the Supabase origin. Images may come from any `https:` host (Supabase storage, markdown). There is no `form-action`, since sign-in forms redirect to Google and Supabase.

`.github/workflows/ci.yml` runs typecheck and tests on pull requests and on pushes to `main`. `deploy.yml` pins the Vercel CLI and the actions, and gives the Vercel secrets only to the steps that call it. Dependabot proposes weekly npm and Actions updates, grouped by minor and patch.
