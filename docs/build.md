# Build

## Layout

```
app/
  page.tsx                      landing
  login/page.tsx
  welcome/page.tsx
  play/page.tsx                 lobby
  play/new/page.tsx             pool picker
  play/[gameId]/page.tsx        round
  play/[gameId]/result/page.tsx
  leaderboard/page.tsx
  me/page.tsx
  rules/page.tsx
  admin/page.tsx                home: spend, volume, pause
  admin/stats/page.tsx
  admin/models/page.tsx
  admin/categories/page.tsx
  admin/families/page.tsx
  admin/rounds/page.tsx
  admin/rounds/[gameId]/page.tsx
  api/                          the routes in Server
lib/
  config.ts                     the numbers, imported by the rules page and by POST /api/games
  prompt.ts                     the system prompt
  game.ts                       pool, given chips, compare, score
  openrouter.ts                 one function, generateText, usage parsed out
  supabase/server.ts            session client and service-role client
components/                     chips, guess bar, transcript, theme toggle
app/globals.css                 light and dark tokens. Default follows the system
public/logos/                   company marks
supabase/migrations/            the tables in Data
```

`lib/game.ts` is the only place that decides a chip, a price, or a pool. Routes load rows and call it. Components render the public object and do not reimplement the rules.

`lib/config.ts` exports the object stored on `games.rules`, plus `hourlyCap: 10` and the built-in jackpot multipliers. Those multipliers are seeded into `categories`. After that, a round copies the multiplier off the category row, so an admin edit does not require a deploy. The rules page reads the category rows for the multipliers and `config.ts` for everything else.

## Env

| Name | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `OPENROUTER_API_KEY` | Server only |
| `ADMIN_EMAIL` | Server only. The one address that can open admin |

Local values go in `.env.local`. That file stays untracked. Vercel gets the same names. The service role key, the OpenRouter key, and `ADMIN_EMAIL` are sensitive. Do not prefix `ADMIN_EMAIL` with `NEXT_PUBLIC_`.

## First roster

Verify every slug on OpenRouter before enabling it. Prices and dates below are for seeding, not for billing. Billing uses `usage.cost_usd`. Families with one model stay disabled until a second model exists.

Slugs checked against public listings in October 2026. Re-check on the day of the seed. `released_on` is required before enable, and several of these dates still need to be copied off the model page.

| Our id | OpenRouter id | Company | Family | Size | Reasoning | Notes |
|---|---|---|---|---|---|---|
| `claude-opus-4-8` | `anthropic/claude-opus-4.8` | Anthropic | opus | large | yes | Pair with Opus 5.5 so the family can be played |
| `claude-opus-5-5` | `anthropic/claude-opus-5.5` | Anthropic | opus | large | yes | Confirm the slug. Expensive. `is_latest` |
| `claude-sonnet-5` | `anthropic/claude-sonnet-5` | Anthropic | sonnet | medium | yes | |
| `claude-sonnet-5-5` | `anthropic/claude-sonnet-5.5` | Anthropic | sonnet | medium | yes | Released 2026-09-28. `is_latest` |
| `claude-haiku-5-5` | `anthropic/claude-haiku-5.5` | Anthropic | haiku | small | yes | Released 2026-10-07. Family stays disabled until a second Haiku exists |
| `gpt-5-6-luna` | `openai/gpt-5.6-luna` | OpenAI | gpt | small | yes | Treat Luna / Sol / Terra as one family until play says otherwise |
| `gpt-5-6-sol` | `openai/gpt-5.6-sol` | OpenAI | gpt | medium | yes | `is_latest` |
| `gpt-5-6-terra` | `openai/gpt-5.6-terra` | OpenAI | gpt | large | yes | |
| `deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | DeepSeek | deepseek | small | yes | China. Confirm open weights on the model page |
| `deepseek-v4-pro` | `deepseek/deepseek-v4-pro` | DeepSeek | deepseek | large | yes | |
| `mistral-medium-3-5` | `mistralai/mistral-medium-3-5` | Mistral | mistral | medium | confirm | Europe |
| `mistral-large-2512` | `mistralai/mistral-large-2512` | Mistral | mistral | large | confirm | |

Leave Fable out. For each reasoning model, the seed starts with `{ "reasoning": { "effort": "low" } }`. Play one round. If `reasoning_tokens` stays high, change the object and play again before `enabled` is true.

Companies to insert first: Anthropic `us`, OpenAI `us`, DeepSeek `cn`, Mistral `eu`. Logos can be simple letter marks until real files exist. The path still has to resolve.

The seed script inserts missing ids and does not update a row whose `updated_at` is newer than the seed file. Admin edits survive a re-seed.

## Order

The game is fun, or it is not, before the leaderboard exists.

1. Migration from [Data](data.md). Seed the roster disabled. App shell with the landing page and a hardcoded round is not required. Go straight to one real call.
2. `lib/openrouter.ts` and `lib/prompt.ts`. Enable Haiku only. Play one round. Read `reasoning_tokens` and the transcript. Confirm it does not name itself.
3. `lib/game.ts`: pool, given chips, compare, score. All-models mode, five messages, the chip board, one guess per message. Play 20 rounds across the cheap models. If a family is indistinguishable, disable that family. Do not change the schema to save it.
4. Reveals, blind, and the frozen score on the result page.
5. Supabase auth, `/welcome`, the hourly cap, one active round.
6. The other categories, including custom. They are pool filters plus the given-chip rule. Custom adds the picker and leaves `scored` false.
7. Leaderboard and profile.
8. Admin: spend, stats, families, roster, recent rounds.
9. Deploy to the `*.vercel.app` URL. A domain comes after someone besides us is playing.

Step 3 is allowed to set models `enabled = false`. It is not allowed to add a mechanic that is not in [Rules](rules.md).
