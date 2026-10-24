# Data

One Supabase Postgres database. The catalog, the rounds, and the cost ledger are tables in it.

## Migrations

The schema is the timestamped files in `supabase/migrations/`, run by the Supabase CLI in name order. `20261021080000_baseline.sql` is the whole schema as it stood on 21 Oct 2026: a fresh database (local, CI, a new project) runs it first, and production is marked as already applied: its 35 old history rows are first marked reverted, then `supabase migration repair --status applied 20261021080000`. `20261022151319_category_icons.sql` gives `categories` an icon and opens the Category mode. `20261022185816_category_enabled_default_icon.sql` adds `categories.enabled` and the `default` icon kind. `20261021090000_hardening.sql` revokes every table privilege from `anon` and `authenticated` on the tables they must never touch. `supabase/seed.sql` is a snapshot of the production catalog (roster, companies, categories, `openrouter_providers` slugs, `app_settings`) with no player data; it upserts, so it is safe on top of the baseline's own rows, and `supabase db reset` runs it after the migrations. A change is a new file from `npm run db:new <name>`. An applied file is never edited. A new table gets its explicit `GRANT` and its row level security in the same file. Production receives migrations only from the deploy workflow on a release. The bucket rows for `avatars` and `logos` are created by the baseline, not by `config.toml`.

The browser may read `companies` and the view `models_public`. Those rows are the roster a player is allowed to see. `models_public` is `models` where `enabled` is true, and the columns are `id`, `name`, `company_id`, and `logo_path`. It omits `openrouter_id`, `provider_settings`, `size`, `released_on`, `open_weights`, and `reasoning`. The guess list for a round does not come from this view. The server sends logo, company, and name for the models that are still legal. `categories` and `model_categories` are admin tables. The lobby, the leaderboard, and the share card read them on the server. The browser does not read those tables. The Category game mode (`game_modes.id = 'class'`) is open.

The secret of an open round is `games.model_id`. The browser never queries `games`. Server routes use the secret key, which bypasses row level security. Row level security denies `anon` and `authenticated` on `games`, `messages`, `guesses`, and `usage`.

There is no hints catalog. Year and size are columns on the model. The fact that this player bought one is `games.hints`.

There is no separate "who played when" table. `games.started_at` and `games.username` are that record. `profiles` is the account. `profiles.id` links the auth user, and therefore the email, to the username.

## Why transcripts are stored

Each round is one row in `games`. That row's `id` is the session id. The player's message and the model's reply are rows in `messages`, tied to that id by `game_id`. One turn is two rows with the same `turn`: `role = user` is what they sent, `role = assistant` is what the model answered.

A user message is at most 500 characters. A reply is at most 2,000 tokens, about 8 KB. A full round is about 50 KB. Ten thousand rounds are about 500 MB.

The text is kept. Later analysis reads `messages` joined to `games` on `game_id`. The admin round page also reads it, because a 1,000-token reply has room to say its own name. Score, guesses, and the leaderboard do not read `messages`, so a point does not depend on the text. Deleting an account clears that player's name from their games and leaves the rounds, messages, and guesses in place. Other players' rounds stay.

A failed call writes `usage` and does not write `messages`, because there is no stored reply. The system prompt is not a row.

The table is part of the baseline migration, with its comments, row level security, and service-role grant.

## Access

| Table | `anon` / `authenticated` | Service role |
|---|---|---|
| `companies`, `models_public`, `game_modes` | `select`. The table grant is required as well as the policy. A new Supabase project does not add it | write on the base tables |
| `categories`, `model_categories` | no privileges | read and write |
| `profiles` | `select` own row. No direct `update`: the username is set and renamed through `set_username` | write |
| `games`, `messages`, `guesses`, `usage` | no privileges | read and write |
| `leaderboard(game_mode, since, viewer, p_difficulty, p_company)` | `execute` | execute |

`leaderboard` is a security definer function, not a view of game rows. It returns rank, name, score, whether the row is the signed-in player, and that player's `avatar_path`. The page shows the public picture, or the generated mark when there is no file. The function also returns `user_id`, and the API strips it before the page sees it. `anon` can call it, so the landing page can show the top 5 before login.

`profiles` is created by a trigger on `auth.users`. The user does not insert their own profile row.

## Tables

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `anthropic` |
| `name` | text | |
| `origin` | text, fk `origins` | `us`, `cn`, `eu`, or any origin an admin added. Never free text |
| `logo_path` | text | `logos/{company_id}.png` in the public `logos` bucket, or an `https` URL |
| `created_at` | timestamptz | default `now()` |

The uploaded objects are `anthropic.png`, `openai.png`, `deepseek.png`, and `mistral.png`. The bucket also accepts SVG and WebP, at most 1 MB. The game reads `logo_path`. A missing file shows no image. The bucket is public, so those URLs load. There is no SELECT policy, so clients cannot list the objects. Each object is cached for a year. The URL stays the same between visits.

### `origins`

Where a lab comes from. `companies.origin` and `guesses.guessed_origin` point here. An origin is never deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `us`, `cn`, `eu`. Lowercase letters, digits, and dashes, up to 31 characters, starting with a letter |
| `name` | text | Up to 40 characters. USA, China, Europe |
| `flag` | text | One emoji, drawn as Twemoji. 🇺🇸 🇨🇳 🇪🇺 |
| `sort_order` | int | Button order in the Origin game. Default 100 |
| `enabled` | boolean | Default true. False removes the origin from the Origin game: no button, none of its models drawn. It changes nothing in the other modes, and the origin hint still works |
| `created_at` | timestamptz | |

Rows are readable by everyone. `anon` and `authenticated` cannot write. `service_role` can select, insert, and update, and has no delete or truncate grant. The three starting rows are inserted by the Origin migration. That migration is applied on the dev Supabase project first. Production gets it only from `deploy.yml` on a release.

### `categories`

A category is a group of models for the Category game mode (`game_modes.id = 'class'`; the id stays `class`). Opus can be one category. GPT vs Claude can be another. It is not a row of `game_modes`. A category carries its own icon, one of four kinds, and can be turned off.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | Slug from the name at create, such as `opus` or `gpt-vs-claude`. It does not change when the name is edited. `games.pool_key` stores it for a Category round |
| `name` | text, unique | Display name |
| `description` | text | Short, at most 140 characters (the admin form enforces it). Can be empty |
| `icon_kind` | text | `company`, `image`, `emoji`, or `default` (the Who's that LLM logo). Check constraint |
| `icon_value` | text | `company`: a `companies.id`. `image`: a path in the public `logos` bucket, `categories/{id}-{random}.{ext}`. `emoji`: the emoji. `default`: empty. Otherwise not empty. At most 200 characters. The app checks that a company id exists, there is no foreign key |
| `enabled` | boolean | Default true. Off: not on `/play`, not startable, not in the leaderboard dropdown, left out of the statistics. Rows, links, and games stay |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

An uploaded image is an SVG, PNG, or WebP of at most 1 MB, stored by the admin route under `logos/categories/`. Replacing its image, or ticking **Remove current icon**, removes the old file. A category is turned off, not deleted. The category count on a card is models that are turned on. A category with fewer than two such models is not offered to players.

### `model_categories`

A model can belong to several categories. There is no category column on `models`. The rows cascade when a model or a category is deleted.

| Column | Type | Notes |
|---|---|---|
| `model_id` | text, fk `models` | on delete cascade. Part of the primary key |
| `category_id` | text, fk `categories` | on delete cascade. Part of the primary key |

anon and authenticated cannot read or write these two tables. The server key does that after the owner check.

### `models`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `claude-sonnet-5-5` |
| `openrouter_id` | text, unique | `anthropic/claude-sonnet-5.5` |
| `name` | text | Claude Sonnet 5.5 |
| `company_id` | text, fk | |
| `size` | text | `nano`, `small`, `medium`, `large`, `xxl`. A hint. Not a point trait and not a category |
| `difficulty` | smallint | `1` easy, `2` medium, `3` hard, `4` impossible. Set by admin. OpenRouter does not fill it. The screens show the name. A game at X draws enabled models whose difficulty is `<= X` |
| `open_weights` | boolean | Admin fact. Play does not read it |
| `reasoning` | boolean | Admin fact. Play does not read it |
| `provider_settings` | jsonb | default `{}`. Passed through on the call. Not a player-facing trait |
| `released_on` | date | Required while `enabled`. The year hint reads the calendar year |
| `enabled` | boolean | default false. False keeps the row and pulls the model out of every draw |
| `available` | boolean | default true. False when OpenRouter no longer lists the model, and `enabled` must then be false (`models_unavailable_stays_off`). The availability check sets it false (and `enabled` false) when the model leaves the catalog, and sets it back to true, alone, when it returns. A returning model stays off until the admin turns it on |
| `logo_path` | text, null | Overrides the company logo. Storage path or `https` URL |
| `updated_at` | timestamptz | The seed will not clobber a newer edit |

Checks:

- `size` is `nano`, `small`, `medium`, `large`, or `xxl`.
- `enabled` implies `released_on` is not null.
- `enabled` and `reasoning` together imply `provider_settings` is not `{}`. That check is there so a thinking model cannot be turned on with no effort setting. It does not put reasoning into the game.

`open_weights` and `reasoning` stay on the row so admin can see them and so a seed can record them. They are not copied into `games.traits`. They are not on `models_public`. They are not chips, hints, filters, or score terms.

Origin is not a column here. It comes from the company. The year hint uses `extract(year from released_on)` at the moment the round starts, then reads the frozen year.

`enabled` is the on/off switch. Turning it off is how a model is removed from play. The row stays, so old rounds still resolve the name from `games.traits`. A hard delete is allowed only when no `games.model_id` points at it.

Editing `company_id`, `size`, `released_on`, or the company origin applies to new games only. A round already started keeps `games.traits`.

anon and authenticated cannot insert, update, or delete `models` or `companies`. The server key does that after the owner check. There is no public function for the private roster counts.

### `openrouter_providers`

One row per OpenRouter provider slug that has served a reply, in a normal game or in admin chat. A missing slug has not served one. `blacklisted` true is sent as `provider.ignore` on later calls. A new row is not blacklisted. An existing blacklist stays until it is cleared. The baseline migration creates the table. anon and authenticated cannot read or write it, and the hardening migration revokes every table privilege from them as well.

| Column | Type | Notes |
|---|---|---|
| `slug` | text, pk | Provider slug OpenRouter returned, such as `chutes` |
| `blacklisted` | boolean | True skips the provider. False is trusted and may stream |
| `reason` | text, null | Written when the row is blacklisted. Date, model, provider, the input and output text, and the token counts |
| `model` | text, null | OpenRouter model id on the latest reply stored for this slug |
| `input_text` | text, null | The system prompt and messages sent on that call |
| `output_text` | text, null | The visible reply |
| `input_tokens` | int, null | Reported prompt tokens |
| `output_tokens` | int, null | Reported completion tokens |
| `reasoning_tokens` | int, null | Reported reasoning tokens |
| `cached_tokens` | int, null | Reported cache-read tokens |
| `gpt_tokens` | int, null | gpt-tokenizer count of the visible reply |
| `created_at` | timestamptz | First time this slug was stored |
| `updated_at` | timestamptz | Last verdict. Clearing a blacklist updates this and leaves `reason` in place |

### `game_modes`

The lobby and the leaderboard read this table. The built-in rows are seeded and cannot be deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `daily`, `all`, `class`, `company`, `origin`, `custom`. Never changes. `games.game_mode` stores it |
| `name` | text | Card title |
| `blurb` | text | The one sentence on the main page and on the card |
| `enabled` | boolean | False hides the lobby card. The main page still shows the blurb, with **Coming soon.** Past rounds stay |
| `leaderboard` | boolean | True for `all`, `daily`, `company`, and `class`. False for the others. A Company or Category board lists one row per player and can be narrowed to one company or category through `p_company` |
| `hints_allowed` | boolean | True for `daily`, `all`, `company`, `class`, and `custom`. False for `origin` and every other row |
| `sort_order` | int | Main page and lobby order |
| `created_at` | timestamptz | |

`daily`, `all`, `company`, `class`, `origin`, and `custom` are enabled. Only `daily`, `all`, `company`, and `class` have a leaderboard. The Custom migration enabled `custom` with no leaderboard, hints allowed, and the blurb `Pick your own models, at least two, and guess which one is hiding.` The leaderboard bar shows Daily, All models, Company, and Category. Origin and Custom are not on that bar. The Origin migration replaced the old `region` row with `origin` (blurb: Ten messages, one guess: where does this model come from?) and repointed `games.game_mode`.

Every scored round uses the formula in [Rules](rules.md). The category row does not store a multiplier.

### `app_settings`

One row, `id = 1`.

| Column | Type | Notes |
|---|---|---|
| `id` | int, pk | Check `id = 1` |
| `paused` | boolean | True refuses new rounds and new messages. Set by admin, and by a credit error |

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk, fk `auth.users` | on delete cascade. The email is not copied onto `games`, `profiles`, or the leaderboard |
| `username` | text, null | Null until `/welcome`. Not unique. A rename rewrites this and every `games.username` for this id |
| `avatar_path` | text, null | Object path in the public `avatars` bucket, `{user id}/{timestamp}.{ext}`. Null keeps the generated mark. Cached for a year. A new upload uses a new path, so the new picture shows up |
| `created_at` | timestamptz | |

When `username` is not null, its trimmed length is 3–20. The name must equal its trimmed form and may not contain a line break. Capitals and punctuation are allowed. There is no character class. Two profiles may share a username. The account is `id`.

### `games`

One row per round.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | default `gen_random_uuid()` |
| `user_id` | uuid, null, fk `profiles` | on delete set null, so deleting the account clears this and `username`. The round stays. A null `user_id` is off the leaderboard |
| `username` | text, null | Copied at insert, then rewritten when that user renames. Cleared when the account is deleted. Leaderboard name for that round |
| `game_mode` | text, fk `game_modes` | |
| `pool_key` | text, null | A company id for `company`, a `categories.id` for `class`. Null for `all`, `daily`, `origin`, and `custom` |
| `difficulty` | smallint, null | `1` easy, `2` medium, `3` hard, `4` impossible. The difficulty the round was played at. Null for a round that has no difficulty, including Custom and rounds from before difficulties |
| `pool_model_ids` | text[] | The models that were legal when the round started. For `custom`, the picked models that were enabled |
| `model_id` | text, fk `models` | |
| `traits` | jsonb | Frozen at insert. Scoring, filtering, feedback, and the result page read this, not the live catalog |
| `status` | text | `active`, `solved`, `miss`, `given_up` |
| `no_hint` | boolean | |
| `rules` | jsonb | The config snapshot. Scoring reads this, not today's file |
| `hints` | text[] | default `'{}'`. `year`, `size`, or both. Empty when no-hint, and when the category disallows hints |
| `message_count` | int | 0–10. User messages stored. Also the number of stored replies |
| `awaiting_guess` | boolean | True after a stored reply. False after a guess, and while the next message is being called. A failed call sets it true again when that turn still has a reply and no guess. Give-up ends the round instead |
| `score` | int, null | Written once, at the end, when `message_count` is at least 1. Never negative. Null when they give up before any reply |
| `score_breakdown` | jsonb, null | The integer lines, in order, not including the total |
| `score_explanation` | text[], null | The short public lines |
| `daily_key` | text, null | `2026-10-12:1` for Easy through `:4` for Impossible. Set only for `daily`. The unique `(user_id, daily_key)` pair allows two difficulties the same day and refuses a second round of one difficulty |
| `started_at` | timestamptz | default `now()`. The hourly cap counts these |
| `finished_at` | timestamptz, null | |
| `call_started_at` | timestamptz, null | Set while a model call is in flight. A call older than 3 minutes can be claimed again, so a crashed request does not lock the round. Cleared when the reply is stored, aborted, or the round ends |

The share card at `/r/{id}` reads this row: mode, pool, difficulty, status, message count, score, and every line inside `score_breakdown`. The model name comes from `traits`. Daily leaves that name off the card. The card does not read `messages`. The PNG is drawn when someone downloads it or when a share preview asks for it. It is not stored. The download name is `whos-that-llm-` plus the game id.

Indexes:

- `(user_id, started_at desc)` for the hourly count and, later, the profile history
- unique `(user_id, game_mode, difficulty)` where `status = 'active'`. One unfinished round per mode and difficulty. Easy can stay open while Medium starts. It replaces the older unique `(user_id)` index.
- unique `(user_id, daily_key)` where `daily_key is not null`. One Daily round per account per difficulty per UTC day, because the key includes the difficulty. `start_game` writes `daily_key` only for `daily`
- unique `(user_id, game_mode, pool_key)` where `status = 'active'` and `game_mode` is `company` or `class`. One unfinished Company round per company, one unfinished Category round per category
- unique `(user_id)` where `status = 'active'` and `game_mode = 'custom'` (`games_one_active_custom_idx`). One unfinished Custom round per account
- unique `(user_id)` where `status = 'active'` and `game_mode = 'origin'` (`games_one_active_origin_idx`). One unfinished Origin round per account
- `(game_mode, status, finished_at)` for the leaderboard

### `daily_models`

The hidden model for one difficulty on one UTC day. `games.daily_key` records that this account already played that difficulty. It does not record which model everyone else got. Two people starting Medium together could otherwise draw two models. This table is that shared pick. Easy and Medium are separate rows.

| Column | Type | Notes |
|---|---|---|
| `played_on` | date, pk | UTC date. Part of the primary key |
| `difficulty` | smallint, pk | `1` easy through `4` impossible. Part of the primary key |
| `model_id` | text, fk `models` | The model every Daily round at this difficulty uses today |

The first start of that day and difficulty inserts the row. The inserted model must have `difficulty <=` the chosen level, so Easy cannot store an Impossible model. A concurrent second start hits the primary key, does nothing, and reads the stored id. The next UTC day has no row yet, so each level draws again. anon and authenticated cannot read the table. The model id is the answer.

`start_game` fills `games.daily_key` from this table. Daily is on, and its blurb is **One round per difficulty. Everyone at that level gets the same model. A new puzzle tomorrow.**

`games_user_id_fkey` is `on delete set null`, and `games.user_id`, `games.username`, and `usage.user_id` nullable. The server clears `user_id` and `username` on that player's games, and clears `usage.user_id`, before it deletes the auth user. Messages and guesses stay, because they cascade from `games` only when a game row is deleted. `public.leaderboard()` skips games whose `user_id` or `username` is null, so a deleted player is not a blank row and is not pooled with other deleted players. Game, solve, token, and guess counts still include those rounds. Profile history reads `games.user_id`, so it does not. anon and authenticated still cannot delete these tables. The server action uses the service key after it has read the session.

`rules` shape:

```json
{
  "messageLimit": 10,
  "maxUserChars": 500,
  "maxOutputTokens": 2000,
  "modelBase": 2000,
  "originPoints": 100,
  "companyPoints": 300,
  "tokenScale": 10000,
  "tokenCap": 20,
  "hintCosts": { "year": 100, "size": 100, "origin": 400, "company": 600 },
  "difficultyMultipliers": { "easy": 0.5, "medium": 1, "hard": 2, "impossible": 3 },
  "wrongGuessCost": 100,
  "noHintMultiplier": 2,
  "hintsAllowed": true
}
```

`hintsAllowed` is copied from `game_modes.hints_allowed` at start. The other fields are copied from config. Scoring reads the current config numbers when the round ends, so a stored copy from an older version does not change the score. `hints` may only contain `company`, `origin`, `year`, and `size`, each once. The route checks that.

`traits` shape:

```json
{
  "given": ["origin"],
  "models": {
    "claude-sonnet-5-5": {
      "name": "Claude Sonnet 5.5",
      "companyId": "anthropic",
      "companyName": "Anthropic",
      "origin": "us",
      "size": "medium",
      "year": 2026,
      "logoPath": "https://example.supabase.co/storage/v1/object/public/logos/anthropic.png"
    }
  }
}
```

One entry per id in `pool_model_ids`, including the hidden model. `given` lists traits whose value is the same on every entry. Weights and reasoning are absent on purpose.

`score_breakdown` is an array of lines in the order [Rules](rules.md) specifies. A points line is `{ "label": "Named the model", "points": 2000 }`. A multiplier line is `{ "label": "Tokens · 2,694 tokens", "points": null, "multiplier": "×3.712" }`. `score_explanation` is the public lines, in the order [Pages](pages.md) specifies.

### `messages`

The transcript of one round. Keep these rows. Do not delete old transcripts to reclaim space.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, fk `games` on delete cascade | |
| `turn` | int | 1–10 |
| `role` | text | `user` or `assistant` |
| `content` | text | Assistant content may be empty or whitespace. That row still counts |
| `created_at` | timestamptz | |

Unique `(game_id, turn, role)`. The system prompt is not a row.

### `guesses`

One row per submitted guess, including the solve and a wrong fifth guess. Give-up writes nothing here. Unique `(game_id, turn)`, which is what makes "one guess per message" true even if two requests race: the second insert fails. Origin is the exception: it has at most one guess row, and `turn` is the message the guess was submitted on.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, fk | |
| `turn` | int | |
| `guessed_model_id` | text, fk `models`, null | The model the player named. Null on an Origin guess |
| `guessed_origin` | text, fk `origins`, null | For a model guess, copy it from the frozen company. For an Origin guess, the origin the player chose |
| `model_correct` | boolean | True when the named model is the hidden one |
| `company_correct` | boolean | |
| `origin_correct` | boolean | |
| `created_at` | timestamptz | |

An Origin guess sets `model_correct` and `origin_correct` to the same value and `company_correct` to false.

There is no year, size, weights, or reasoning column on a guess. Those are not match traits. Year and size live in `games.hints`.

### `usage`

One row per OpenRouter call, including failures.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, null | |
| `user_id` | uuid, null | Cleared when the account is deleted. The row stays on `game_id` |
| `model_id` | text | |
| `openrouter_generation_id` | text, null | |
| `input_tokens` | int | default 0. Full prompt count OpenRouter returned, including the system prompt and resent history. The score does not replace this number |
| `output_tokens` | int | Completion tokens for that reply |
| `reasoning_tokens` | int | Admin cost fact. Not added into the score |
| `cache_read_tokens` | int | Not added into the score, and not subtracted from it |
| `cost_usd` | numeric | 0 when the call failed |
| `error_code` | text, null | |
| `created_at` | timestamptz | |

The score reads successful rows (`error_code` is null) in `created_at` order when a round ends. The count is `scoreTokens` in `lib/game.ts`. The first row counts its full `input_tokens`. Each later row counts `input_tokens` minus the previous row's `input_tokens` minus the previous row's `output_tokens`. Every row's `output_tokens` is added. A finished game keeps `games.score`. Those rows are not rewritten.

## Profile trigger

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

## Queries

Leaderboard, one game mode, one period (the Daily and All models shape; Company and Category boards filter on `pool_key` in place of the difficulty). The latest function body is in `20261022151319_category_icons.sql`; this is its shape, without the extra return columns (`user_id`, `avatar_path`, `difficulty`, `no_hint`, company or category id, name and logo). `since` is the start of the window, or `-infinity` for all time. Rank is the row number of the final order.

```sql
with best as (
  select distinct on (g.user_id)
         g.user_id,
         g.username,
         g.score,
         g.message_count,
         g.finished_at
  from games g
  join game_modes c on c.id = g.game_mode
  where c.leaderboard
    and g.user_id is not null
    and g.username is not null and btrim(g.username) <> ''
    and g.game_mode = game_mode
    and g.status in ('solved', 'miss')
    and g.score is not null
    and g.finished_at is not null
    and g.finished_at >= since
    -- plus the difficulty or pool_key filter, see below
  order by g.user_id, g.score desc, g.message_count asc, g.finished_at asc
)
select username as name, score
from best
order by score desc, message_count asc, finished_at asc, username;
```

`given_up` is excluded. A score of 0 remains. Grouping is by `user_id`, so shared usernames do not merge. The name on the row is `games.username` from that best round. A rename rewrites it.

Every mode passes `p_difficulty`. Null is Any difficulty: every finished round in that mode whose difficulty is set, whichever of 1–4 it was. `1`, `2`, `3`, or `4` keeps rounds played at that difficulty. The row returns that round's `difficulty` and `no_hint`. Rounds with a null difficulty stay off the boards.

Right company, never named the model. "Found" means any guess in that round hit it.

```sql
select t.name as truth,
       count(distinct g.id) filter (where gs.company_correct) as company_found,
       count(distinct g.id) as rounds
from games g
join models t on t.id = g.model_id
left join guesses gs on gs.game_id = g.id
where g.status = 'miss'
group by t.name
order by company_found desc;
```

The model name in that query can also come from `games.traits`. Prefer the frozen name when the live row has been renamed.

Hints bought:

```sql
select hint, count(*) as times_bought
from games g
cross join lateral unnest(g.hints) as hint
group by hint
order by times_bought desc;
```

Confusion, wrong model guesses only:

```sql
select t.name as truth,
       m.name as guessed,
       count(*) as n
from guesses gs
join games g on g.id = gs.game_id
join models t on t.id = g.model_id
join models m on m.id = gs.guessed_model_id
where gs.model_correct = false
  and gs.guessed_model_id is not null
group by t.name, m.name
order by n desc;
```

Hourly cap. Run inside the insert transaction.

```sql
select count(*)
from games
where user_id = $1
  and started_at > now() - interval '1 hour';
```

Spend this UTC month:

```sql
select m.name,
       sum(u.cost_usd) as usd,
       count(*) as calls,
       sum(u.reasoning_tokens) as reasoning_tokens
from usage u
join models m on m.id = u.model_id
where u.created_at >= date_trunc('month', timezone('utc', now())) at time zone 'utc'
group by m.name
order by usd desc;
```

`reasoning_tokens` in that query is the admin cost column. It is not a game trait.
