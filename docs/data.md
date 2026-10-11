# Data

One Supabase Postgres database. The catalog, the rounds, and the cost ledger are tables in it.

The browser may read `companies` and the view `models_public`. Those rows are the roster a player is allowed to see. `models_public` is `models` where `enabled` is true, and the columns are `id`, `name`, `company_id`, and `logo_path`. It omits `openrouter_id`, `provider_settings`, the two prices, `size`, `released_on`, `open_weights`, and `reasoning`. The guess list for a round does not come from this view. The server sends logo, company, and name for the models that are still legal. `classes` and `model_classes` are admin tables. The public statistics page reads class membership on the server. The browser does not read those tables. The class game mode is not built.

The secret of an open round is `games.model_id`. The browser never queries `games`. Server routes use the secret key, which bypasses row level security. Row level security denies `anon` and `authenticated` on `games`, `messages`, `guesses`, and `usage`.

There is no hints catalog. Year and size are columns on the model. The fact that this player bought one is `games.hints`.

There is no separate "who played when" table. `games.started_at` and `games.username` are that record. `profiles` is the account. `profiles.id` links the auth user, and therefore the email, to the username.

## Why transcripts are stored

Each round is one row in `games`. That row's `id` is the session id. The player's message and the model's reply are rows in `messages`, tied to that id by `game_id`. One turn is two rows with the same `turn`: `role = user` is what they sent, `role = assistant` is what the model answered.

A user message is at most 500 characters. A reply is at most 1,000 tokens, about 4 KB. A full round is about 30 KB. Ten thousand rounds are about 300 MB.

The text is kept. Later analysis reads `messages` joined to `games` on `game_id`. The admin round page also reads it, because a 1,000-token reply has room to say its own name. Score, guesses, and the leaderboard do not read `messages`, so a point does not depend on the text. Deleting an account clears that player's name from their games and leaves the rounds, messages, and guesses in place. Other players' rounds stay.

A failed call writes `usage` and does not write `messages`, because there is no stored reply. The system prompt is not a row.

`supabase/migrations/0002_transcripts.sql` is the file to run in the Supabase SQL editor for this table. It is safe after `0001_init.sql`. The create does nothing when `messages` is already there. The comments, row level security, and the service-role grant still apply.

## Access

| Table | `anon` / `authenticated` | Service role |
|---|---|---|
| `companies`, `models_public`, `categories` where `enabled` | `select`. The table grant is required as well as the policy. A new Supabase project does not add it | write on the base tables |
| `classes`, `model_classes` | no privileges | read and write |
| `profiles` | `select` own row. `update` own row only while `username` is null. A later rename goes through `set_username` | write |
| `games`, `messages`, `guesses`, `usage` | no privileges | read and write |
| `leaderboard(category, since)` | `execute` | execute |

`leaderboard` is a security definer function, not a view of game rows. It returns rank, name, score, whether the row is the signed-in player, and that player's `avatar_path`. The page shows the public picture, or the generated mark when there is no file. It does not show the account id. `anon` can call it, so the landing page can show the top 5 before login.

`profiles` is created by a trigger on `auth.users`. The user does not insert their own profile row.

## Tables

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `anthropic` |
| `name` | text | |
| `region` | text | `us`, `cn`, `eu`. Shown as USA, China, Europe |
| `logo_path` | text | `logos/{company_id}.png` in the public `logos` bucket, or an `https` URL |
| `created_at` | timestamptz | default `now()` |

The uploaded objects are `anthropic.png`, `openai.png`, `deepseek.png`, and `mistral.png`. The bucket also accepts SVG and WebP, at most 1 MB. The game reads `logo_path`. A missing file shows no image. The bucket is public, so those URLs load. There is no SELECT policy, so clients cannot list the objects. Each object is cached for a year. The URL stays the same between visits.

### `classes`

A class is a group of models for a later game mode. It is not a game category. Opus can be one class. GPT vs Claude can be another. There is no logo column. When a class has a company, a later screen uses that company's logo. When it has none, that screen uses the site logo.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | Slug from the name at create, such as `opus` or `gpt-vs-claude`. It does not change when the name is edited |
| `name` | text, unique | Display name |
| `description` | text | Can be empty |
| `company_id` | text, null, fk `companies` | Optional. Set null on company delete |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `model_classes`

A model can belong to several classes. There is no class column on `models`.

| Column | Type | Notes |
|---|---|---|
| `model_id` | text, fk `models` | on delete cascade. Part of the primary key |
| `class_id` | text, fk `classes` | on delete cascade. Part of the primary key |

anon and authenticated cannot read or write these two tables. The server key does that after the owner check.

### `models`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `claude-sonnet-5-5` |
| `openrouter_id` | text, unique | `anthropic/claude-sonnet-5.5` |
| `name` | text | Claude Sonnet 5.5 |
| `company_id` | text, fk | |
| `size` | text | `small`, `medium`, `large`. A hint. Not a point trait and not a category |
| `open_weights` | boolean | Admin fact. Play does not read it |
| `reasoning` | boolean | Admin fact. Play does not read it |
| `provider_settings` | jsonb | default `{}`. Passed through on the call. Not a player-facing trait |
| `released_on` | date | Required while `enabled`. The year hint reads the calendar year |
| `enabled` | boolean | default false. False keeps the row and pulls the model out of every draw |
| `logo_path` | text, null | Overrides the company logo. Storage path or `https` URL |
| `input_usd_per_mtok` | numeric, null | List price, admin only |
| `output_usd_per_mtok` | numeric, null | |
| `updated_at` | timestamptz | The seed will not clobber a newer edit |

Checks:

- `size` is `small`, `medium`, or `large`.
- `enabled` implies `released_on` is not null.
- `enabled` and `reasoning` together imply `provider_settings` is not `{}`. That check is there so a thinking model cannot be turned on with no effort setting. It does not put reasoning into the game.

`open_weights` and `reasoning` stay on the row so admin can see them and so a seed can record them. They are not copied into `games.traits`. They are not on `models_public`. They are not chips, hints, filters, or score terms.

Region is not a column here. It comes from the company. The year hint uses `extract(year from released_on)` at the moment the round starts, then reads the frozen year.

`enabled` is the on/off switch. Turning it off is how a model is removed from play. The row stays, so old rounds still resolve the name from `games.traits`. A hard delete is allowed only when no `games.model_id` points at it.

Editing `company_id`, `size`, `released_on`, or the company region applies to new games only. A round already started keeps `games.traits`.

anon and authenticated cannot insert, update, or delete `models` or `companies`. The server key does that after the owner check. There is no public function for the private roster counts.

### `categories`

The lobby and the leaderboard read this table. The built-in rows are seeded and cannot be deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `daily`, `all`, `company`, `region`, `custom`. Never changes. `games.category` stores it |
| `name` | text | Card title |
| `blurb` | text | The one sentence on the main page and on the card |
| `enabled` | boolean | False hides the lobby card. The main page still shows the blurb, with **Coming soon.** Past rounds stay |
| `leaderboard` | boolean | True for `all` and `daily`. False for the others. A class leaderboard is one board per class, and it is not built |
| `hints_allowed` | boolean | True only for `daily`, `all`, and `custom`. False for `company`, `region`, and every other row |
| `sort_order` | int | Main page and lobby order |
| `created_at` | timestamptz | |

Seed `enabled` true only for `all`. The others are seeded false until they are built. Seed `leaderboard` true for `all` and `daily` even while `daily` is disabled, so the column matches the rule. A disabled category with no finished rounds still has no tab.

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

When `username` is not null, its trimmed length is 3–20. Capitals and punctuation are allowed. The check is on length after trim, not on a character class. Two profiles may share a username. The account is `id`.

### `games`

One row per round.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | default `gen_random_uuid()` |
| `user_id` | uuid, null, fk `profiles` | on delete set null, after `0017_anonymize_games_on_account_delete.sql`. Deleting the account clears this and `username`. The round stays. A null `user_id` is off the leaderboard |
| `username` | text, null | Copied at insert, then rewritten when that user renames. Cleared when the account is deleted. Leaderboard name for that round |
| `category` | text, fk `categories` | |
| `pool_key` | text, null | `anthropic`, `opus`, `us`, `cn`, or `eu`. Null for `all`, `daily`, and `custom` |
| `pool_model_ids` | text[] | The models that were legal when the round started |
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
| `daily_key` | date, null | UTC date. Set only for `daily` |
| `started_at` | timestamptz | default `now()`. The hourly cap counts these |
| `finished_at` | timestamptz, null | |
| `call_started_at` | timestamptz, null | Set while a model call is in flight. A call older than 3 minutes can be claimed again, so a crashed request does not lock the round. Cleared when the reply is stored, aborted, or the round ends |

Indexes:

- `(user_id, started_at desc)` for the hourly count and, later, the profile history
- unique `(user_id)` where `status = 'active'`
- unique `(user_id, daily_key)` where `daily_key is not null`
- `(category, status, finished_at)` for the leaderboard

`0014_delete_games_with_account.sql` put `games_user_id_fkey` back as `on delete cascade`. `0017_anonymize_games_on_account_delete.sql` replaces that with `on delete set null` and makes `games.user_id`, `games.username`, and `usage.user_id` nullable. The server clears `user_id` and `username` on that player's games, and clears `usage.user_id`, before it deletes the auth user. Messages and guesses stay, because they cascade from `games` only when a game row is deleted. `public.leaderboard()` skips games whose `user_id` or `username` is null, so a deleted player is not a blank row and is not pooled with other deleted players. Game, solve, token, and guess counts still include those rounds. Profile history reads `games.user_id`, so it does not. anon and authenticated still cannot delete these tables. The server action uses the service key after it has read the session.

`rules` shape:

```json
{
  "messageLimit": 10,
  "maxUserChars": 500,
  "maxOutputTokens": 1000,
  "modelBase": 2000,
  "regionPoints": 100,
  "companyPoints": 300,
  "tokenScale": 10000,
  "tokenCap": 10,
  "hintCosts": { "year": 100, "size": 100, "region": 400, "company": 600 },
  "wrongGuessCost": 100,
  "noHintMultiplier": 2,
  "hintsAllowed": true
}
```

`hintsAllowed` is copied from `categories.hints_allowed` at start. The other fields are copied from config. Scoring reads the current config numbers when the round ends, so a stored copy from an older version does not change the score. `hints` may only contain `company`, `region`, `year`, and `size`, each once. The route checks that.

`traits` shape:

```json
{
  "given": ["region"],
  "models": {
    "claude-sonnet-5-5": {
      "name": "Claude Sonnet 5.5",
      "companyId": "anthropic",
      "companyName": "Anthropic",
      "region": "us",
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
| `turn` | int | 1–5 |
| `role` | text | `user` or `assistant` |
| `content` | text | Assistant content may be empty or whitespace. That row still counts |
| `created_at` | timestamptz | |

Unique `(game_id, turn, role)`. The system prompt is not a row.

### `guesses`

One row per submitted guess, including the solve and a wrong fifth guess. Give-up writes nothing here. Unique `(game_id, turn)`, which is what makes "one guess per message" true even if two requests race: the second insert fails. Origin is the exception later: it has at most one guess row, and `turn` is the message the guess was submitted on.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, fk | |
| `turn` | int | |
| `guessed_model_id` | text, fk `models`, null | The model the player named |
| `guessed_region` | text, null | `us` / `cn` / `eu`. For a model guess, copy it from the frozen company |
| `model_correct` | boolean | True when the named model is the hidden one |
| `company_correct` | boolean | |
| `region_correct` | boolean | |
| `created_at` | timestamptz | |

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
| `input_tokens` | int | default 0 |
| `output_tokens` | int | |
| `reasoning_tokens` | int | Admin cost fact. Not added into the score |
| `cache_read_tokens` | int | Not added into the score |
| `cost_usd` | numeric | 0 when the call failed |
| `error_code` | text, null | |
| `created_at` | timestamptz | |

The score sums `input_tokens + output_tokens` where `error_code` is null.

## Profile trigger

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

## Queries

Leaderboard, one category, one period. The function body is this query. `since` is the start of the window, or `-infinity` for all time. Rank is the row number of the final order.

```sql
with best as (
  select distinct on (g.user_id)
         g.user_id,
         g.username,
         g.score,
         g.message_count,
         g.finished_at
  from games g
  join categories c on c.id = g.category
  where c.leaderboard
    and g.category = category
    and g.status in ('solved', 'miss')
    and g.score is not null
    and g.finished_at is not null
    and g.finished_at >= since
  order by g.user_id, g.score desc, g.message_count asc, g.finished_at asc
)
select username as name, score
from best
order by score desc, message_count asc, finished_at asc, username;
```

`given_up` is excluded. A score of 0 remains. Grouping is by `user_id`, so shared usernames do not merge. The name on the row is `games.username` from that best round. A rename rewrites it.

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
