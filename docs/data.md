# Data

One Supabase Postgres database. The catalog, the rounds, and the cost ledger are tables in it.

The browser may read `companies`, `families`, and the view `models_public`. Those rows are the roster a player is allowed to see. `models_public` is `models` where `enabled` is true, and the columns are `id`, `name`, `company_id`, and `logo_path`. It omits `openrouter_id`, `provider_settings`, the two prices, `family_id`, `size`, `released_on`, `is_latest`, `open_weights`, and `reasoning`. The guess list for a round does not come from this view. The server sends logo, company, and name for the models that are still legal.

The secret of an open round is `games.model_id`. The browser never queries `games`. Server routes use the secret key, which bypasses row level security. Row level security denies `anon` and `authenticated` on `games`, `messages`, `guesses`, and `usage`.

There is no hints catalog. Year and size are columns on the model. The fact that this player bought one is `games.hints`.

There is no separate "who played when" table. `games.started_at` and `games.username` are that record. `profiles` is the account. `profiles.id` links the auth user, and therefore the email, to the username.

## Why transcripts are stored

Each round is one row in `games`. That row's `id` is the session id. The player's message and the model's reply are rows in `messages`, tied to that id by `game_id`. One turn is two rows with the same `turn`: `role = user` is what they sent, `role = assistant` is what the model answered.

A user message is at most 500 characters. A reply is at most 500 tokens, about 2 KB. A full round is about 15 KB. Ten thousand rounds are about 150 MB.

The text is kept. Later analysis reads `messages` joined to `games` on `game_id`. The admin round page also reads it, because a 500-token reply has room to say its own name. Score, guesses, and the leaderboard do not read `messages`, so a point does not depend on the text. That is not a reason to delete the rows. A round and its transcript stay.

A failed call writes `usage` and does not write `messages`, because there is no stored reply. The system prompt is not a row.

`supabase/migrations/0002_transcripts.sql` is the file to run in the Supabase SQL editor for this table. It is safe after `0001_init.sql`. The create does nothing when `messages` is already there. The comments, row level security, and the service-role grant still apply.

## Access

| Table | `anon` / `authenticated` | Service role |
|---|---|---|
| `companies`, `families`, `models_public`, `categories` where `enabled` | `select`. The table grant is required as well as the policy. A new Supabase project does not add it | write on the base tables |
| `profiles` | `select` own row. `update` own `username` only, and only while that column is null until profile edits exist | write |
| `games`, `messages`, `guesses`, `usage` | no privileges | read and write |
| `leaderboard(category, since)` | `execute` | execute |

`leaderboard` is a security definer function, not a view of game rows. It exposes rank, name, and score only. `anon` can call it, so the landing page can show the weekly top 5 before login, once that block exists.

`profiles` is created by a trigger on `auth.users`. The user does not insert their own profile row.

## Tables

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `anthropic` |
| `name` | text | |
| `region` | text | `us`, `cn`, `eu`. Shown as USA, China, Europe |
| `logo_path` | text | A path in Supabase Storage, or an `https` URL when upload is unavailable |
| `created_at` | timestamptz | default `now()` |

Logo upload is part of admin, which is later. Until then a seed path such as `/logos/anthropic.svg` is enough, and the file has to resolve.

### `families`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `opus`. Never changes. Past rounds store it inside `games.traits` |
| `name` | text, unique | Display, editable |
| `enabled` | boolean | False hides it from the family picker. Models keep the id |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

The id is the stable key. Past rounds copy the display name into `games.traits`, so a rename does not rewrite them.

### `models`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `claude-sonnet-5-5` |
| `openrouter_id` | text, unique | `anthropic/claude-sonnet-5.5` |
| `name` | text | Claude Sonnet 5.5 |
| `company_id` | text, fk | |
| `family_id` | text, fk | |
| `size` | text | `small`, `medium`, `large`. A hint. Not a point trait and not a category |
| `open_weights` | boolean | Admin fact. Play does not read it |
| `reasoning` | boolean | Admin fact. Play does not read it |
| `provider_settings` | jsonb | default `{}`. Passed through on the call. Not a player-facing trait |
| `is_latest` | boolean | The newest model in its family. Admin only. It does not make a category |
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

Editing `company_id`, `family_id`, `size`, `released_on`, or the company region applies to new games only. A round already started keeps `games.traits`.

### `categories`

The lobby and the leaderboard read this table. The built-in rows are seeded and cannot be deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `daily`, `all`, `company`, `family`, `region`, `custom`. Never changes. `games.category` stores it |
| `name` | text | Card title |
| `blurb` | text | The one sentence on the main page and on the card |
| `enabled` | boolean | False hides the lobby card. The main page still shows the blurb, with **Not open yet.** Past rounds stay |
| `leaderboard` | boolean | True for `all` and `daily`. False for the others. A main family board can be turned on later |
| `hints_allowed` | boolean | True for `all`, `region`, and `daily`. False for `company`, `family`, and `custom` |
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
| `id` | uuid, pk, fk `auth.users` | on delete cascade. This id links the auth user to the username. The email stays in Supabase Auth. It is not copied onto `games` or the leaderboard |
| `username` | text, null | Null until `/welcome`. Not unique |
| `created_at` | timestamptz | |

When `username` is not null, its trimmed length is 3–20. Capitals and punctuation are allowed. The check is on length after trim, not on a character class. Two profiles may share a username. The account is `id`.

### `games`

One row per round.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | default `gen_random_uuid()` |
| `user_id` | uuid, fk `profiles` | on delete restrict. Deleting the auth user will not delete their rounds |
| `username` | text | Copied at insert. Leaderboard name for that round |
| `category` | text, fk `categories` | |
| `pool_key` | text, null | `anthropic`, `opus`, `us`, `cn`, or `eu`. Null for `all`, `daily`, and `custom` |
| `pool_model_ids` | text[] | The models that were legal when the round started |
| `model_id` | text, fk `models` | |
| `traits` | jsonb | Frozen at insert. Scoring, filtering, feedback, and the result page read this, not the live catalog |
| `status` | text | `active`, `solved`, `miss`, `given_up` |
| `no_hint` | boolean | |
| `rules` | jsonb | The config snapshot. Scoring reads this, not today's file |
| `hints` | text[] | default `'{}'`. `year`, `size`, or both. Empty when no-hint, and when the category disallows hints |
| `message_count` | int | 0–5. User messages stored. Also the number of stored replies |
| `awaiting_guess` | boolean | True after a stored reply, false after a guess. Give-up ends the round instead |
| `score` | int, null | Written once, at the end, when `message_count` is at least 1. May be negative. Null when they give up before any reply |
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

`rules` shape:

```json
{
  "messageLimit": 5,
  "maxUserChars": 500,
  "maxOutputTokens": 500,
  "modelBase": 1000,
  "regionPoints": 100,
  "companyPoints": 300,
  "tokenScale": 1000,
  "hintCost": 100,
  "noHintMultiplier": 1.5,
  "hintsAllowed": true
}
```

`hintsAllowed` is copied from `categories.hints_allowed` at start. The other fields are copied from config. `hints` may only contain `year` and `size`, each once. The route checks that.

`traits` shape:

```json
{
  "given": ["region"],
  "models": {
    "claude-sonnet-5-5": {
      "name": "Claude Sonnet 5.5",
      "companyId": "anthropic",
      "companyName": "Anthropic",
      "familyId": "sonnet",
      "familyName": "Sonnet",
      "region": "us",
      "size": "medium",
      "year": 2026,
      "logoPath": "/logos/anthropic.svg"
    }
  }
}
```

One entry per id in `pool_model_ids`, including the hidden model. `given` lists traits whose value is the same on every entry. Weights and reasoning are absent on purpose.

`score_breakdown` is an array of `{ "label": "Named the model", "points": 1000 }`, in the order [Rules](rules.md) specifies. `score_explanation` is the public lines, in the order [Pages](pages.md) specifies.

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
| `family_correct` | boolean | Stored for feedback and for the later daily stat. Pays nothing |
| `region_correct` | boolean | |
| `created_at` | timestamptz | |

There is no year, size, weights, or reasoning column on a guess. Those are not match traits. Year and size live in `games.hints`.

### `usage`

One row per OpenRouter call, including failures.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, null | |
| `user_id` | uuid | |
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

`given_up` is excluded. A negative score remains. Grouping is by `user_id`, so shared usernames do not merge. The name on the row is the username copied onto that best round.

Right company, never named the model. "Found" means any guess in that round hit it.

```sql
select t.name as truth,
       count(distinct g.id) filter (where gs.company_correct) as company_found,
       count(distinct g.id) filter (where gs.family_correct) as family_found,
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
