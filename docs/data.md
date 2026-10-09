# Data

One Supabase Postgres database. The catalog, the rounds, and the cost ledger are tables in it.

The browser may read `companies`, `families`, and the view `models_public`. Those rows are the roster a player is allowed to see. `models_public` is `models` where `enabled` is true, and it omits `openrouter_id`, `provider_settings`, and the two prices. The secret is `games.model_id` on an open round, and the browser never queries `games`. Server routes use the service role. Row level security denies `anon` and `authenticated` on `games`, `messages`, `guesses`, and `usage`.

There is no hints table. A hint is a column on the model. The fact that this player bought it is `games.revealed`.

There is no separate "who played when" table. `games.started_at` and `games.username` are that record. `profiles` is the account.

## Why transcripts are stored

A user message is at most 500 characters. A reply is at most 500 tokens, about 2 KB. A full round is about 15 KB. Ten thousand rounds are about 150 MB.

The admin round page needs the text, because a 500-token reply has room to say its own name. Score, guesses, and the leaderboard do not read `messages`. Old transcripts can be deleted later without moving a point.

## Access

| Table | `anon` / `authenticated` | Service role |
|---|---|---|
| `companies`, `families`, `models_public`, `categories` where `enabled` | `select` | write on the base tables |
| `profiles` | `select` all rows. `update` own `username` only | write |
| `games`, `messages`, `guesses`, `usage` | no privileges | read and write |
| `leaderboard` | `select` | read |

`leaderboard` is a `security definer` view. It exposes aggregates only.

`profiles` is created by a trigger on `auth.users`. The user does not insert their own profile row.

## Tables

### `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `anthropic` |
| `name` | text | |
| `region` | text | `us`, `eu`, `cn` |
| `logo_path` | text | `/logos/anthropic.svg` |
| `created_at` | timestamptz | default `now()` |

### `families`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `opus`. Never changes. Past rounds store it |
| `name` | text, unique | Display, editable |
| `enabled` | boolean | False hides it from the picker. Models keep the id |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `models`

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `claude-sonnet-5-5` |
| `openrouter_id` | text, unique | `anthropic/claude-sonnet-5.5` |
| `name` | text | Claude Sonnet 5.5 |
| `company_id` | text, fk | |
| `family_id` | text, fk | |
| `size` | text | `small`, `medium`, `large` |
| `open_weights` | boolean | |
| `reasoning` | boolean | |
| `provider_settings` | jsonb | default `{}`. Passed through on the call |
| `is_latest` | boolean | |
| `released_on` | date | Required while `enabled` |
| `enabled` | boolean | default false. False keeps the row and pulls the model out of every draw |
| `logo_path` | text, null | Overrides the company logo |
| `input_usd_per_mtok` | numeric, null | List price, admin only |
| `output_usd_per_mtok` | numeric, null | |
| `updated_at` | timestamptz | The seed will not clobber a newer edit |

Checks:

- `region` and `size` are the enums above.
- `enabled` implies `released_on` is not null.
- `enabled` and `reasoning` together imply `provider_settings` is not `{}`.

Region is not a column here. It comes from the company. The year chip uses `extract(year from released_on)`. Direction compares the dates.

`enabled` is the on/off switch. Turning it off is how a model is removed from play. The row stays, so old rounds still resolve the name. A hard delete is allowed only when no `games.model_id` and no `category_models` row points at it.

### `categories`

The lobby and the leaderboard read this table. The nine built-in rows are seeded and cannot be deleted. Further rows are pools you create in admin.

| Column | Type | Notes |
|---|---|---|
| `id` | text, pk | `all`, `daily`, or `opus-vs-sonnet`. Never changes. `games.category` stores it |
| `name` | text | Card title |
| `blurb` | text | The one sentence on the card |
| `kind` | text | `builtin` or `pool` |
| `enabled` | boolean | False hides the card. Past rounds stay |
| `scored` | boolean | False means no score and no leaderboard tab. Custom is the built-in false |
| `jackpot_multiplier` | numeric | Copied into `games.rules` at start. Built-ins use the values in [Rules](rules.md). A new pool defaults to 1 |
| `sort_order` | int | Lobby order |
| `created_at` | timestamptz | |

### `category_models`

Only for `kind = pool`. Built-in categories compute their pool in code.

| Column | Type | Notes |
|---|---|---|
| `category_id` | text, fk `categories` | |
| `model_id` | text, fk `models` | |

Primary key `(category_id, model_id)`. A draw uses rows whose model is `enabled`. A disabled model can stay on the list so that turning it back on puts it in the category again.

### `app_settings`

One row, `id = 1`.

| Column | Type | Notes |
|---|---|---|
| `id` | int, pk | Check `id = 1` |
| `paused` | boolean | True refuses new rounds and new messages |

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk, fk `auth.users` | on delete cascade |
| `username` | text, unique, null | Null until `/welcome` |
| `created_at` | timestamptz | |

`username` matches `^[A-Za-z0-9_]{3,20}$` when it is not null. The reserved names are rejected in the route, not in the check, so the list can change without a migration.

### `games`

One row per round.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | default `gen_random_uuid()` |
| `user_id` | uuid, fk `profiles` | |
| `username` | text | Copied at insert |
| `category` | text, fk `categories` | The category id, including pools created later |
| `pool_key` | text, null | `anthropic`, `opus`, `us`, `large`, `all-latest`, or a company id for latest-of-one-company. Null for `all`, `daily`, `origin`, `custom` |
| `pool_model_ids` | text[] | The models that were legal when the round started. The guess list reads this, not the live roster. For `custom`, it is the set the player checked |
| `model_id` | text, fk `models` | |
| `status` | text | `active`, `solved`, `finished`, `given_up` |
| `blind` | boolean | |
| `rules` | jsonb | The config snapshot. Scoring reads this, not today's file |
| `revealed` | text[] | default `'{}'`. Keys from the characteristic list. Empty when blind |
| `message_count` | int | 0–5. User messages stored |
| `awaiting_guess` | boolean | True after a stored reply, false after a guess or a skip |
| `scored` | boolean | Copied from the category at start. The leaderboard ignores false |
| `score` | int, null | Written once, at the end, when `scored`. `max(0, raw)`. Stays null for custom |
| `score_breakdown` | jsonb, null | Written once, at the end, when `scored` |
| `daily_key` | date, null | UTC date. Set only for `daily` |
| `started_at` | timestamptz | default `now()`. The hourly cap counts these |
| `finished_at` | timestamptz, null | |

Indexes:

- `(user_id, started_at desc)` for the hourly count and the profile history
- unique `(user_id)` where `status = 'active'`
- unique `(user_id, daily_key)` where `daily_key is not null`

`rules` shape:

```json
{
  "messageLimit": 5,
  "maxUserChars": 500,
  "maxOutputTokens": 500,
  "blindMultiplier": 1.25,
  "jackpotBase": 800,
  "jackpotStep": 100,
  "categoryMultiplier": 1,
  "match": {
    "company": 200,
    "family": 150,
    "year": 100,
    "size": 80,
    "region": 60,
    "weights": 50,
    "reasoning": 40
  },
  "reveal": {
    "company": 250,
    "family": 180,
    "year": 120,
    "size": 100,
    "region": 80,
    "weights": 70,
    "reasoning": 50
  }
}
```

`revealed` may only contain those seven keys, each once. The route checks that. A database check is optional.

### `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, fk `games` on delete cascade | |
| `turn` | int | 1–5 |
| `role` | text | `user` or `assistant` |
| `content` | text | |
| `created_at` | timestamptz | |

Unique `(game_id, turn, role)`. The system prompt is not a row.

### `guesses`

One row per submission, including the solve. A skip writes nothing. Unique `(game_id, turn)`, which is what makes "one guess per message" true even if two requests race: the second insert fails.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `game_id` | uuid, fk | |
| `turn` | int | |
| `guessed_model_id` | text, fk `models`, null | Null for origin |
| `guessed_region` | text, null | `us` / `eu` / `cn`. Always set. For a model guess, copy it from that model's company |
| `model_correct` | boolean | False for every origin guess |
| `company_correct` | boolean | |
| `family_correct` | boolean | |
| `region_correct` | boolean | |
| `size_correct` | boolean | |
| `weights_correct` | boolean | |
| `year_correct` | boolean | |
| `year_direction` | text, null | `newer`, `older`, or null when the year matched |
| `reasoning_correct` | boolean | |
| `created_at` | timestamptz | |

`year_direction` is from the player's point of view of the truth: `newer` means the hidden model was released later than the guess.

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
| `reasoning_tokens` | int | |
| `cache_read_tokens` | int | |
| `cost_usd` | numeric | 0 when the call failed |
| `error_code` | text, null | |
| `created_at` | timestamptz | |

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

Leaderboard, one category, one period. `$2` is the start of the window, or `-infinity` for all time.

```sql
select p.username,
       count(*) as games,
       round(avg(g.score))::int as avg_points,
       avg((g.status = 'solved')::int) as solve_rate,
       avg(g.message_count) filter (where g.status = 'solved') as avg_messages_to_solve
from games g
join profiles p on p.id = g.user_id
where g.scored
  and g.category = $1
  and g.finished_at is not null
  and g.finished_at >= $2
group by p.id, p.username
order by avg_points desc, solve_rate desc, games desc, p.username;
```

One finished scored round is enough to appear. Rank is by average points. Games played is on the row so a one-game average and an 80-game average are not the same kind of number. Solved % counts `solved` only. Average messages counts solved rounds only, so a player who never solves does not get a flattering low number from giving up on message 1. The total is not a column. It is games times the average.

`scored` is false for custom, so those rounds cannot pad a tab. Group by `p.id` as well as the name. The unique constraint already forbids shared names.

Right company, missed the model. Use the best guess in the round (a later guess may correct an earlier miss). "Found" means any guess in that unfinished round hit it.

```sql
select t.name as truth,
       count(distinct g.id) filter (where gs.company_correct) as company_found,
       count(distinct g.id) filter (where gs.family_correct) as family_found,
       count(distinct g.id) as rounds
from games g
join models t on t.id = g.model_id
left join guesses gs on gs.game_id = g.id
where g.status in ('finished', 'given_up')
group by t.name
order by company_found desc;
```

Reveals:

```sql
select hint, count(*) as times_bought
from games g
cross join lateral unnest(g.revealed) as hint
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
where u.created_at >= date_trunc('month', now() at time zone 'utc')
group by m.name
order by usd desc;
```
