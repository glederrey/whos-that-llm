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
public/logos/                   seed marks until Storage upload exists
public/brand/                   site logo copies. tail_right when the text is on the right, tail_left when it is on the left
supabase/migrations/            the tables in Data
```

There is no `rules/page.tsx`. There is no `me/page.tsx` in the first build.

`lib/game.ts` is the only place that decides a match, a hint, a filter, or a score. Routes load rows and call it. Components render the public object and do not reimplement the rules.

`lib/config.ts` exports the object stored on `games.rules`, plus `hourlyCap: 10` and `tipUrl`. Category flags (`leaderboard`, `hints_allowed`, `enabled`) are seeded into `categories`. A round copies `hintsAllowed` off the category row and the numbers off config, then freezes traits, so an admin edit does not rewrite a game in progress.

```ts
{
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 500,
  modelBase: 1000,
  regionPoints: 100,
  companyPoints: 300,
  tokenScale: 1000,
  hintCost: 100,
  wrongGuessCost: 50,
  noHintMultiplier: 1.5,
  hourlyCap: 10,
  tipUrl: ""
}
```

`tokenScale` is the 1000 in `1000 / tokens`. `modelBase` is the 1000 for naming the model. They are equal in this first version. They may be refined after Gael plays. Do not add a cap in code. `tipUrl` is the Ko-fi page. Empty hides the footer link. The Cursor credit is not config. It is the footer specified in [Pages](pages.md).

## Env

| Name | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. The publishable key |
| `SUPABASE_SECRET_KEY` | Server only. The secret key. Bypasses row level security |
| `OPENROUTER_API_KEY` | Server only |
| `ADMIN_EMAIL` | Server only. The one address that can open admin, once admin exists |

Those five names are already in `.env.local` at the repo root. Comments in the file do not matter. The values stay in that file: do not open it to check them, and do not copy them into docs, chat, or git. The file stays untracked. Vercel gets the same names. The secret key, the OpenRouter key, and `ADMIN_EMAIL` are sensitive. Do not prefix `ADMIN_EMAIL` or `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_`.

In Supabase, set the site URL and the email redirect URLs to the site root `/`, so confirmation and password reset return to the main page.

## First roster

Verify every slug on OpenRouter before enabling it. Prices and dates below are for seeding, not for billing. Billing uses `usage.cost_usd`. Families with one model stay disabled until a second model exists, so the later Family card is not a one-model pool. All models can still draw a model whose family is disabled.

The prototype turns on six small models and leaves every other row disabled. There is no admin page yet, so this seed is the roster you can try:

- Claude Haiku 4.5 (`claude-haiku-4-5`)
- Claude Haiku 5.5 (`claude-haiku-5-5`)
- GPT-5.6 Luna (`gpt-5-6-luna`)
- GPT-5.6 Luna Pro (`gpt-5-6-luna-pro`)
- GPT-6 Luna (`gpt-6-luna`)
- DeepSeek V4 Flash (`deepseek-v4-flash`)

That pool has three companies and two regions, USA and China, so a guess can hit or miss both point traits. A wrong name can now stay inside Anthropic or OpenAI. OpenRouter has no other small Anthropic model, so Haiku 4.5 is the only extra Anthropic row. A full round on Haiku 5.5, the Lunas, or Flash is under about 1 cent. Haiku 4.5 is a few cents. More models wait until admin exists.

Slugs checked against public listings in October 2026. Re-check on the day of the seed. `released_on` is required before enable, and several of these dates still need to be copied off the model page.

| Our id | OpenRouter id | Company | Family | Size | Reasoning | Notes |
|---|---|---|---|---|---|---|
| `claude-opus-4-8` | `anthropic/claude-opus-4.8` | Anthropic | opus | large | yes | Pair with Opus 5.5 so the family can be played later |
| `claude-opus-5-5` | `anthropic/claude-opus-5.5` | Anthropic | opus | large | yes | Confirm the slug. Expensive. `is_latest` |
| `claude-sonnet-5` | `anthropic/claude-sonnet-5` | Anthropic | sonnet | medium | yes | |
| `claude-sonnet-5-5` | `anthropic/claude-sonnet-5.5` | Anthropic | sonnet | medium | yes | Released 2026-09-28. `is_latest` |
| `claude-haiku-4-5` | `anthropic/claude-haiku-4.5` | Anthropic | haiku | small | yes | Starts enabled. Released 2025-10-15. The only other small Anthropic id on OpenRouter. $1 / $5 per million tokens |
| `claude-haiku-5-5` | `anthropic/claude-haiku-5.5` | Anthropic | haiku | small | yes | Starts enabled. Released 2026-10-07. Haiku is enabled now that a second Haiku exists |
| `gpt-5-6-luna` | `openai/gpt-5.6-luna` | OpenAI | gpt | small | yes | Starts enabled. Treat Luna / Sol / Terra as one family until play says otherwise |
| `gpt-5-6-luna-pro` | `openai/gpt-5.6-luna-pro` | OpenAI | gpt | small | yes | Starts enabled. Released 2026-07-09. Same list price as GPT-5.6 Luna |
| `gpt-6-luna` | `openai/gpt-6-luna` | OpenAI | gpt | small | yes | Starts enabled. Released 2026-09-22. $0.10 / $0.50 per million tokens |
| `gpt-5-6-sol` | `openai/gpt-5.6-sol` | OpenAI | gpt | medium | yes | `is_latest` |
| `gpt-5-6-terra` | `openai/gpt-5.6-terra` | OpenAI | gpt | large | yes | |
| `deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | DeepSeek | deepseek | small | yes | Starts enabled. China. Open weights is an admin fact. Confirm it on the model page. Play does not use it |
| `deepseek-v4-pro` | `deepseek/deepseek-v4-pro` | DeepSeek | deepseek | large | yes | |
| `mistral-medium-3-5` | `mistralai/mistral-medium-3-5` | Mistral | mistral | medium | confirm | Europe |
| `mistral-large-2512` | `mistralai/mistral-large-2512` | Mistral | mistral | large | confirm | |

Leave Fable out. The Reasoning column is an admin fact for `provider_settings` and for cost. It is not a chip. For each reasoning model, the seed starts with `{ "reasoning": { "effort": "low" } }`. Play one round of each enabled model. If `reasoning_tokens` stays high, set that model back to `enabled = false` and change the object before turning it on again.

Companies to insert first: Anthropic `us`, OpenAI `us`, DeepSeek `cn`, Mistral `eu`. Labels on screen are USA, China, and Europe. Logos can be simple letter marks until real files exist. The path still has to resolve. Storage upload comes with admin.

The seed script inserts missing ids and does not update a row whose `updated_at` is newer than the seed file. Admin edits survive a re-seed. Built-in categories get `sort_order` in the order of the blurb table in [Pages](pages.md). Seed All models enabled. Seed the other categories disabled. Seed leaderboard and hint flags as in [Data](data.md).

## Order

The first build is a playable All models round. Gael plays it locally, then the other categories.

1. Migration from [Data](data.md). Seed the roster. Enable Haiku 4.5, Haiku 5.5, GPT-5.6 Luna, GPT-5.6 Luna Pro, GPT-6 Luna, and DeepSeek V4 Flash. Leave every other company disabled. Seed All models enabled as a category, and the other categories disabled.
2. App shell: landing page, login, welcome, footer, theme. Email links return to `/`. A session is required before `/play`.
3. `lib/openrouter.ts` and `lib/prompt.ts`. Stream the reply word by word. Play one round on Haiku. Read `reasoning_tokens` and the transcript. Confirm it does not name itself. Confirm an empty successful reply still spends the message.
4. `lib/game.ts`: frozen traits, server-filtered guess list, compare, hints, no-hint mode, score. All models, ten messages, a guess the player can skip, give up. The result page shows the breakdown and the short explanation, including a negative total. Play across the enabled models. If a family is indistinguishable, disable that family. Do not change the schema to save it.
5. The hourly cap and one active round. A credit error sets `app_settings.paused` for everyone.
6. Leaderboard for All models: rank, name, best score.
7. Later: daily, company, family, region, custom. They are pool filters plus the given-trait rule. Custom is a choice of models. There is no Latest category and no Origin category.
8. Later: home weekly top 5 and daily result stats. The profile, with stats, past games, and username changes, is in this prototype.
9. Later: admin. Spend, stats, families, roster, logos in Supabase Storage with a URL fallback, pause switch, recent rounds.
10. Deploy to the `*.vercel.app` URL. A domain comes after someone besides us is playing.

Step 4 is allowed to set models `enabled = false`. It is not allowed to add a mechanic that is not in [Rules](rules.md). Do not add a cap on the token factor. If a credit error pauses the game before the admin page exists, clear `app_settings.paused` after topping up on OpenRouter.
