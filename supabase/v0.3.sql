-- v0.3 baseline for a fresh database.
-- This is not a patch for a database that already has the migrations.
-- A fresh database is already at this level: games.game_mode records which
-- mode was played, categories are the model sets (formerly classes), Daily
-- shares one model per difficulty per UTC day, and OpenRouter providers can
-- be trusted or blacklisted.
-- This includes the migrations through 0032_openrouter_providers.sql.
-- Do not run 0028 through 0032 after this script.
-- Run later migration scripts starting with 0033, in filename order.

create table public.companies (
  id text primary key,
  name text not null,
  region text not null check (region in ('us', 'cn', 'eu')),
  logo_path text not null,
  created_at timestamptz not null default now()
);

create table public.models (
  id text primary key,
  openrouter_id text not null unique,
  name text not null,
  company_id text not null references public.companies (id),
  size text not null check (size in ('nano', 'small', 'medium', 'large', 'xxl')),
  difficulty smallint not null check (difficulty between 1 and 4),
  open_weights boolean not null default false,
  reasoning boolean not null default false,
  provider_settings jsonb not null default '{}'::jsonb,
  released_on date,
  enabled boolean not null default false,
  logo_path text,
  input_usd_per_mtok numeric,
  output_usd_per_mtok numeric,
  updated_at timestamptz not null default now(),
  constraint models_enabled_needs_date check (not enabled or released_on is not null),
  constraint models_reasoning_needs_settings check (
    not enabled or not reasoning or provider_settings <> '{}'::jsonb
  )
);

create table public.game_modes (
  id text primary key,
  name text not null,
  blurb text not null,
  enabled boolean not null default false,
  leaderboard boolean not null default false,
  hints_allowed boolean not null default false,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key check (id = 1),
  paused boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  avatar_path text,
  constraint username_len check (
    username is null
    or (
      char_length(btrim(username)) between 3 and 20
      and username = btrim(username)
      and username !~ '[\n\r]'
    )
  )
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  username text,
  game_mode text not null references public.game_modes (id),
  pool_key text,
  difficulty smallint check (difficulty is null or difficulty between 1 and 4),
  pool_model_ids text[] not null,
  model_id text not null references public.models (id),
  traits jsonb not null,
  status text not null check (status in ('active', 'solved', 'miss', 'given_up')),
  no_hint boolean not null default false,
  rules jsonb not null,
  hints text[] not null default '{}',
  message_count int not null default 0 check (message_count between 0 and 10),
  awaiting_guess boolean not null default false,
  score int,
  score_breakdown jsonb,
  score_explanation text[],
  daily_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  call_started_at timestamptz
);

comment on column public.games.daily_key is
  'UTC date and difficulty, such as 2026-10-12:1. Set only for daily. Null for every other mode. The unique (user_id, daily_key) index still refuses a second round of the same difficulty on the same day.';

create table public.daily_models (
  played_on date not null,
  difficulty smallint not null check (difficulty between 1 and 4),
  model_id text not null references public.models (id),
  primary key (played_on, difficulty)
);

comment on table public.daily_models is
  'The hidden model for one difficulty on one UTC day. The first Daily start stores it. Later starts that day use the same row.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null check (turn between 1 and 10),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (game_id, turn, role)
);

comment on table public.messages is
  'Transcript of one round. role user is the player, role assistant is the model. Kept for later analysis. The score does not read these rows.';

comment on column public.messages.game_id is
  'The round. games.id is the session id.';

comment on column public.messages.turn is
  '1 to 10. The player row and the model row of one exchange share this number.';

comment on column public.messages.role is
  'user or assistant.';

comment on column public.messages.content is
  'The player text, or the model reply. An empty reply is still stored.';

create table public.guesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null,
  guessed_model_id text references public.models (id),
  guessed_region text check (guessed_region in ('us', 'cn', 'eu')),
  model_correct boolean not null,
  company_correct boolean not null,
  region_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (game_id, turn)
);

create table public.usage (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete cascade,
  user_id uuid,
  model_id text not null,
  openrouter_generation_id text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  reasoning_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cost_usd numeric not null default 0,
  error_code text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  name text not null unique,
  description text not null default '',
  company_id text references public.companies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.model_categories (
  model_id text not null references public.models (id) on delete cascade,
  category_id text not null references public.categories (id) on delete cascade,
  primary key (model_id, category_id)
);

create index games_user_started_idx on public.games (user_id, started_at desc);
create unique index games_one_active_idx on public.games (user_id) where status = 'active';
create unique index games_daily_idx on public.games (user_id, daily_key) where daily_key is not null;
create index games_leaderboard_idx on public.games (game_mode, status, finished_at);
create index model_categories_category_idx on public.model_categories (category_id);

create view public.models_public as
  select id, name, company_id, logo_path
  from public.models
  where enabled;

alter view public.models_public set (security_invoker = true);

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

create function public.set_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(coalesce(p_username, ''));
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if char_length(cleaned) < 3 or char_length(cleaned) > 20 or cleaned ~ '[\n\r]' then
    return jsonb_build_object('ok', false, 'error', 'username');
  end if;
  update public.profiles set username = cleaned where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  update public.games set username = cleaned where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.leaderboard(game_mode text, since timestamptz, viewer uuid default null, p_difficulty smallint default null)
returns table (rank bigint, name text, score int, mine boolean, user_id uuid, avatar_path text, difficulty smallint, no_hint boolean)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (g.user_id)
           g.user_id,
           g.username,
           g.score,
           g.message_count,
           g.finished_at,
           g.difficulty,
           g.no_hint
    from public.games g
    join public.game_modes c on c.id = g.game_mode
    where c.leaderboard
      and g.user_id is not null
      and g.username is not null
      and btrim(g.username) <> ''
      and g.game_mode = leaderboard.game_mode
      and g.status in ('solved', 'miss')
      and g.score is not null
      and g.finished_at is not null
      and g.finished_at >= leaderboard.since
      and (
        (leaderboard.p_difficulty is null and g.difficulty is not null)
        or g.difficulty = leaderboard.p_difficulty
      )
    order by g.user_id, g.score desc, g.message_count asc, g.finished_at asc
  )
  select row_number() over (
           order by best.score desc, best.message_count asc, best.finished_at asc, best.username
         )::bigint as rank,
         best.username as name,
         best.score,
         (leaderboard.viewer is not null and best.user_id = leaderboard.viewer) as mine,
         best.user_id,
         p.avatar_path,
         best.difficulty,
         best.no_hint
  from best
  left join public.profiles p on p.id = best.user_id
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;

create function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'models', (select count(*)::int from public.models where enabled),
    'gamesToday', (
      select count(*)::int
      from public.games
      where finished_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
        and finished_at < (date_trunc('day', now() at time zone 'utc') at time zone 'utc') + interval '1 day'
    ),
    'players', (
      select count(distinct user_id)::int
      from public.games
      where finished_at is not null
        and user_id is not null
    )
  );
$$;

create function public.start_game(
  p_user_id uuid,
  p_hourly_cap int,
  p_game_mode text,
  p_pool_key text,
  p_no_hint boolean,
  p_model_id text,
  p_pool_model_ids text[],
  p_traits jsonb,
  p_rules jsonb,
  p_difficulty smallint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  active_count int;
  recent_count int;
  next_at timestamptz;
  game_mode_row public.game_modes%rowtype;
  rules jsonb;
  no_hint boolean;
  new_id uuid;
  existing_status text;
  today date;
  day_key text;
  chosen_model text;
begin
  select username into profile_name from public.profiles where id = p_user_id for update;
  if profile_name is null then
    return jsonb_build_object('ok', false, 'error', 'username');
  end if;

  if p_game_mode = 'daily' then
    if p_difficulty is null or p_difficulty < 1 or p_difficulty > 4 then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    today := (timezone('utc', now()))::date;
    day_key := to_char(today, 'YYYY-MM-DD') || ':' || p_difficulty::text;
    select id, status into new_id, existing_status
    from public.games
    where user_id = p_user_id
      and daily_key = day_key
    limit 1;
    if new_id is not null then
      if existing_status = 'active' then
        return jsonb_build_object('ok', true, 'gameId', new_id);
      end if;
      return jsonb_build_object('ok', false, 'error', 'daily_done');
    end if;
  end if;

  if coalesce((select paused from public.app_settings where id = 1), false) then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;

  select count(*) into active_count from public.games where user_id = p_user_id and status = 'active';
  if active_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'active_game');
  end if;

  select count(*) into recent_count
  from public.games
  where user_id = p_user_id and started_at > now() - interval '1 hour';
  if recent_count >= p_hourly_cap then
    select min(started_at) + interval '1 hour' into next_at
    from public.games
    where user_id = p_user_id and started_at > now() - interval '1 hour';
    return jsonb_build_object('ok', false, 'error', 'hourly_cap', 'nextAt', next_at);
  end if;

  select * into game_mode_row from public.game_modes where id = p_game_mode;
  if not found or not game_mode_row.enabled then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_difficulty is not null and (p_difficulty < 1 or p_difficulty > 4) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  rules := p_rules || jsonb_build_object('hintsAllowed', game_mode_row.hints_allowed);
  no_hint := p_no_hint;
  if p_game_mode = 'origin' then
    rules := rules || jsonb_build_object('hintsAllowed', false);
    no_hint := false;
  end if;

  if p_game_mode <> 'daily' then
    day_key := null;
  end if;
  chosen_model := p_model_id;
  if p_game_mode = 'daily' then
    insert into public.daily_models (played_on, difficulty, model_id)
    select today, p_difficulty, m.id
    from public.models m
    where m.id = p_model_id
      and m.difficulty <= p_difficulty
    on conflict (played_on, difficulty) do nothing;

    select model_id into chosen_model
    from public.daily_models
    where played_on = today and difficulty = p_difficulty;

    if chosen_model is null then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
  end if;

  insert into public.games (
    user_id, username, game_mode, pool_key, difficulty, pool_model_ids, model_id, traits,
    status, no_hint, rules, hints, message_count, awaiting_guess, daily_key
  ) values (
    p_user_id, profile_name, p_game_mode, p_pool_key, p_difficulty, p_pool_model_ids, chosen_model, p_traits,
    'active', no_hint, rules, '{}', 0, false, day_key
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'gameId', new_id);
exception
  when unique_violation then
    select id into new_id
    from public.games
    where user_id = p_user_id
      and daily_key = day_key
      and status = 'active'
    limit 1;
    if new_id is not null then
      return jsonb_build_object('ok', true, 'gameId', new_id);
    end if;
    if p_game_mode = 'daily' and exists (
      select 1 from public.games
      where user_id = p_user_id and daily_key = day_key
    ) then
      return jsonb_build_object('ok', false, 'error', 'daily_done');
    end if;
    return jsonb_build_object('ok', false, 'error', 'active_game');
end;
$$;

create function public.claim_model_call(p_game_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  limit_count int;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce((select paused from public.app_settings where id = 1), false) then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;
  limit_count := coalesce((g.rules ->> 'messageLimit')::int, 10);
  if g.status <> 'active' or g.message_count >= limit_count then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if g.call_started_at is not null and g.call_started_at > now() - interval '3 minutes' then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  update public.games
  set call_started_at = now(),
      awaiting_guess = false
  where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.apply_reply(
  p_game_id uuid,
  p_user_id uuid,
  p_user_text text,
  p_assistant_text text,
  p_input_tokens int,
  p_output_tokens int,
  p_reasoning_tokens int,
  p_cache_read_tokens int,
  p_cost_usd numeric,
  p_generation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  next_turn int;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.status <> 'active' or g.awaiting_guess or g.call_started_at is null then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  next_turn := g.message_count + 1;
  insert into public.messages (game_id, turn, role, content) values
    (g.id, next_turn, 'user', p_user_text),
    (g.id, next_turn, 'assistant', p_assistant_text);
  insert into public.usage (
    game_id, user_id, model_id, openrouter_generation_id,
    input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cost_usd
  ) values (
    g.id, p_user_id, g.model_id, p_generation_id,
    p_input_tokens, p_output_tokens, p_reasoning_tokens, p_cache_read_tokens, p_cost_usd
  );
  update public.games
  set message_count = next_turn,
      awaiting_guess = true,
      call_started_at = null
  where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.abort_reply(
  p_game_id uuid,
  p_user_id uuid,
  p_error_code text,
  p_pause boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  insert into public.usage (
    game_id, user_id, model_id, input_tokens, output_tokens, reasoning_tokens,
    cache_read_tokens, cost_usd, error_code
  ) values (
    g.id, p_user_id, g.model_id, 0, 0, 0, 0, 0, p_error_code
  );
  update public.games
  set call_started_at = null,
      awaiting_guess = (
        g.message_count >= 1
        and exists (
          select 1 from public.messages m
          where m.game_id = g.id and m.turn = g.message_count and m.role = 'assistant'
        )
        and not exists (
          select 1 from public.guesses q
          where q.game_id = g.id and q.turn = g.message_count
        )
      )
  where id = g.id;
  if p_pause then
    update public.app_settings set paused = true where id = 1;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.apply_guess(
  p_game_id uuid,
  p_user_id uuid,
  p_model_id text,
  p_region text,
  p_model_correct boolean,
  p_company_correct boolean,
  p_region_correct boolean,
  p_finish text,
  p_score int,
  p_breakdown jsonb,
  p_explanation text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.status <> 'active' or not g.awaiting_guess then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if not (p_model_id = any (g.pool_model_ids)) then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if p_finish = 'miss' and g.message_count < coalesce((g.rules ->> 'messageLimit')::int, 10) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if p_finish = 'continue' and (p_model_correct or g.message_count >= coalesce((g.rules ->> 'messageLimit')::int, 10)) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;

  insert into public.guesses (
    game_id, turn, guessed_model_id, guessed_region,
    model_correct, company_correct, region_correct
  ) values (
    g.id, g.message_count, p_model_id, p_region,
    p_model_correct, p_company_correct, p_region_correct
  );

  if p_finish = 'continue' then
    update public.games set awaiting_guess = false where id = g.id;
  else
    update public.games
    set awaiting_guess = false,
        status = p_finish,
        finished_at = now(),
        score = p_score,
        score_breakdown = p_breakdown,
        score_explanation = p_explanation
    where id = g.id;
  end if;
  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'turn');
end;
$$;

create function public.apply_hint(
  p_game_id uuid,
  p_user_id uuid,
  p_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.status <> 'active'
     or g.no_hint
     or coalesce((g.rules ->> 'hintsAllowed')::boolean, false) = false
     or p_key not in ('company', 'region', 'year', 'size')
     or p_key = any (g.hints)
     or p_key = any (select jsonb_array_elements_text(g.traits -> 'given'))
  then
    return jsonb_build_object('ok', false, 'error', 'hint');
  end if;
  update public.games set hints = g.hints || array[p_key] where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.apply_give_up(
  p_game_id uuid,
  p_user_id uuid,
  p_score int,
  p_breakdown jsonb,
  p_explanation text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  update public.games
  set status = 'given_up',
      finished_at = now(),
      awaiting_guess = false,
      call_started_at = null,
      score = case when g.message_count >= 1 then p_score else null end,
      score_breakdown = case when g.message_count >= 1 then p_breakdown else null end,
      score_explanation = case when g.message_count >= 1 then p_explanation else null end
  where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.openrouter_providers (
  slug text primary key,
  blacklisted boolean not null default false,
  reason text,
  model text,
  input_text text,
  output_text text,
  input_tokens int,
  output_tokens int,
  reasoning_tokens int,
  cached_tokens int,
  gpt_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.models enable row level security;
alter table public.game_modes enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.messages enable row level security;
alter table public.guesses enable row level security;
alter table public.usage enable row level security;
alter table public.categories enable row level security;
alter table public.model_categories enable row level security;
alter table public.daily_models enable row level security;
alter table public.openrouter_providers enable row level security;

create policy companies_read on public.companies
  for select to anon, authenticated
  using (true);

create policy companies_no_client_insert on public.companies
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

create policy companies_no_client_update on public.companies
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy companies_no_client_delete on public.companies
  as restrictive
  for delete
  to anon, authenticated
  using (false);

create policy models_no_client_insert on public.models
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

create policy models_no_client_update on public.models
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy models_no_client_delete on public.models
  as restrictive
  for delete
  to anon, authenticated
  using (false);

create policy models_read_enabled on public.models
  for select
  to anon, authenticated
  using (enabled);

create policy game_modes_read on public.game_modes
  for select to anon, authenticated
  using (enabled);

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy categories_no_client on public.categories
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy model_categories_no_client on public.model_categories
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy daily_models_no_client on public.daily_models
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  1048576,
  array['image/svg+xml', 'image/png', 'image/webp']
);

create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

grant usage on schema public to anon, authenticated, service_role;

grant select on public.companies, public.game_modes to anon, authenticated;
grant select on public.models_public to anon, authenticated, service_role;
grant select on public.profiles to authenticated;

grant select, insert, update, delete on
  public.companies,
  public.models,
  public.game_modes,
  public.app_settings,
  public.profiles,
  public.games,
  public.messages,
  public.guesses,
  public.usage,
  public.categories,
  public.model_categories,
  public.daily_models,
  public.openrouter_providers
to service_role;

revoke truncate, trigger, references on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from public, anon, authenticated;

revoke all on table public.models from public, anon, authenticated;
grant select (id, name, company_id, logo_path, enabled) on public.models to anon, authenticated;
revoke insert, update, delete on table public.profiles from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.companies from public, anon, authenticated;
revoke all on table public.categories from public, anon, authenticated;
revoke all on table public.model_categories from public, anon, authenticated;
revoke all on table public.daily_models from public, anon, authenticated;
revoke all on table public.openrouter_providers from public, anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Supabase installs this event trigger on a project. A database without it skips the revoke.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

grant execute on function public.leaderboard(text, timestamptz, uuid, smallint) to anon, authenticated, service_role;
grant execute on function public.public_stats() to anon, authenticated, service_role;

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) from public, anon, authenticated;
revoke all on function public.claim_model_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_reply(uuid, uuid, text, text, int, int, int, int, numeric, text) from public, anon, authenticated;
revoke all on function public.abort_reply(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, int, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.apply_hint(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_give_up(uuid, uuid, int, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.set_username(text) from public, anon, authenticated;

grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) to service_role;
grant execute on function public.claim_model_call(uuid, uuid) to service_role;
grant execute on function public.apply_reply(uuid, uuid, text, text, int, int, int, int, numeric, text) to service_role;
grant execute on function public.abort_reply(uuid, uuid, text, boolean) to service_role;
grant execute on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, int, jsonb, text[]) to service_role;
grant execute on function public.apply_hint(uuid, uuid, text) to service_role;
grant execute on function public.apply_give_up(uuid, uuid, int, jsonb, text[]) to service_role;
grant execute on function public.set_username(text) to authenticated;

insert into public.app_settings (id, paused) values (1, false);

insert into public.companies (id, name, region, logo_path) values
  ('anthropic', 'Anthropic', 'us', 'logos/anthropic.png'),
  ('google', 'Google', 'us', 'logos/google.png'),
  ('meta', 'Meta', 'us', 'logos/meta.png'),
  ('openai', 'OpenAI', 'us', 'logos/openai.png'),
  ('perplexity', 'Perplexity', 'us', 'logos/perplexity.png'),
  ('xai', 'xAI', 'us', 'logos/xai.png'),
  ('alibaba', 'Alibaba', 'cn', 'logos/alibaba.png'),
  ('deepseek', 'DeepSeek', 'cn', 'logos/deepseek.png'),
  ('moonshot', 'Moonshot', 'cn', 'logos/moonshot.png'),
  ('zai', 'Z.ai', 'cn', 'logos/zai.png'),
  ('mistral', 'Mistral', 'eu', 'logos/mistral.png');

insert into public.game_modes (id, name, blurb, enabled, leaderboard, hints_allowed, sort_order) values
  ('daily', 'Daily', 'One round per difficulty. Everyone at that level gets the same model. A new puzzle tomorrow.', true, true, true, 1),
  ('all', 'All models', 'Any model in the roster. Name it, or take the region and the company.', true, true, true, 2),
  ('class', 'Category', 'A set we define, not a lab''s line. Only Opus, only the nano models, or obscure ones.', false, false, false, 3),
  ('company', 'Company', 'The lab is already known. Name the model.', false, false, false, 4),
  ('region', 'Region', 'USA, China, or Europe.', false, false, false, 5),
  ('custom', 'Custom', 'A custom choice of models.', false, false, true, 6);

-- Categories and model_categories have no seed rows.

insert into public.models (
  id, openrouter_id, name, company_id, size, released_on, enabled,
  input_usd_per_mtok, output_usd_per_mtok, difficulty
) values
  ('claude-fable-5-1', 'anthropic/claude-fable-5.1', 'Claude Fable 5.1', 'anthropic', 'xxl', '2026-09-01', false, 10, 50, 4),
  ('claude-opus-5-5', 'anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'anthropic', 'large', '2026-09-22', false, 4, 20, 1),
  ('claude-opus-5', 'anthropic/claude-opus-5', 'Claude Opus 5', 'anthropic', 'large', '2026-07-24', false, 5, 25, 2),
  ('claude-sonnet-5-5', 'anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5', 'anthropic', 'medium', '2026-09-28', false, 2, 10, 1),
  ('claude-sonnet-5', 'anthropic/claude-sonnet-5', 'Claude Sonnet 5', 'anthropic', 'medium', '2026-06-30', false, 2, 10, 2),
  ('claude-haiku-5-5', 'anthropic/claude-haiku-5.5', 'Claude Haiku 5.5', 'anthropic', 'small', '2026-10-07', false, 0.1, 0.5, 2),
  ('claude-haiku-4-5', 'anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'anthropic', 'small', '2025-10-15', false, 1, 5, 3),
  ('claude-fable-5', 'anthropic/claude-fable-5', 'Claude Fable 5', 'anthropic', 'xxl', '2026-06-09', false, 10, 50, 4),
  ('claude-opus-4-8', 'anthropic/claude-opus-4.8', 'Claude Opus 4.8', 'anthropic', 'large', '2026-05-27', false, 5, 25, 3),
  ('claude-opus-4-7', 'anthropic/claude-opus-4.7', 'Claude Opus 4.7', 'anthropic', 'large', '2026-04-16', false, 5, 25, 4),
  ('claude-opus-4-6', 'anthropic/claude-opus-4.6', 'Claude Opus 4.6', 'anthropic', 'large', '2026-02-04', false, 5, 25, 4),
  ('claude-opus-4-5', 'anthropic/claude-opus-4.5', 'Claude Opus 4.5', 'anthropic', 'large', '2025-11-24', false, 5, 25, 3),
  ('claude-opus-4-1', 'anthropic/claude-opus-4.1', 'Claude Opus 4.1', 'anthropic', 'large', '2025-08-05', false, 15, 75, 3),
  ('claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6', 'Claude Sonnet 4.6', 'anthropic', 'medium', '2026-02-17', false, 3, 15, 3),
  ('claude-sonnet-4-5', 'anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 'anthropic', 'medium', '2025-09-29', false, 3, 15, 3),
  ('claude-sonnet-4', 'anthropic/claude-sonnet-4', 'Claude Sonnet 4', 'anthropic', 'medium', '2025-05-22', false, 3, 15, 3),
  ('gemini-3-1-pro-preview', 'google/gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 'google', 'large', '2026-02-19', false, 2, 12, 1),
  ('gemini-3-8-flash', 'google/gemini-3.8-flash', 'Gemini 3.8 Flash', 'google', 'medium', '2026-09-02', false, 0.8, 4, 1),
  ('gemini-3-5-flash-lite', 'google/gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite', 'google', 'small', '2026-07-21', false, 0.3, 3, 4),
  ('gemini-2-5-pro', 'google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'google', 'large', '2025-06-17', false, 1, 10, 2),
  ('gemini-2-5-flash', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'google', 'medium', '2025-06-17', false, 0.3, 3, 3),
  ('gemini-2-5-flash-lite', 'google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 'google', 'small', '2025-07-22', false, 0.1, 0.4, 4),
  ('gemma-4-31b-it', 'google/gemma-4-31b-it', 'Gemma 4 31B', 'google', 'small', '2026-04-02', false, 0.1, 0.3, 4),
  ('gemma-3-27b-it', 'google/gemma-3-27b-it', 'Gemma 3 27B', 'google', 'small', '2025-03-12', false, 0.1, 0.5, 4),
  ('gemma-2-27b-it', 'google/gemma-2-27b-it', 'Gemma 2 27B', 'google', 'small', '2024-07-13', false, 0.7, 0.7, 4),
  ('gemini-3-7-flash', 'google/gemini-3.7-flash', 'Gemini 3.7 Flash', 'google', 'medium', '2026-08-13', false, 0.8, 4, 3),
  ('gemini-3-6-flash', 'google/gemini-3.6-flash', 'Gemini 3.6 Flash', 'google', 'medium', '2026-07-21', false, 0.8, 4, 4),
  ('gemini-3-5-flash', 'google/gemini-3.5-flash', 'Gemini 3.5 Flash', 'google', 'medium', '2026-05-19', false, 2, 9, 4),
  ('gemini-3-flash-preview', 'google/gemini-3-flash-preview', 'Gemini 3 Flash', 'google', 'medium', '2025-12-17', false, 0.5, 3, 3),
  ('gemini-3-1-flash-lite', 'google/gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 'google', 'small', '2026-05-07', false, 0.3, 2, 4),
  ('muse-spark-1-3', 'meta/muse-spark-1.3', 'Muse Spark 1.3', 'meta', 'large', '2026-09-02', false, 1, 4, 3),
  ('muse-glimmer-30b', 'meta/muse-glimmer-30b', 'Muse Glimmer 30B', 'meta', 'small', '2026-08-09', false, 0.3, 1, 4),
  ('llama-4-maverick', 'meta-llama/llama-4-maverick', 'Llama 4 Maverick', 'meta', 'medium', '2025-04-05', false, 0.2, 0.7, 1),
  ('llama-4-scout', 'meta-llama/llama-4-scout', 'Llama 4 Scout', 'meta', 'small', '2025-04-05', false, 0.1, 0.3, 2),
  ('llama-3-3-70b-instruct', 'meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B', 'meta', 'medium', '2024-12-06', false, 0.2, 0.5, 3),
  ('llama-3-1-8b-instruct', 'meta-llama/llama-3.1-8b-instruct', 'Llama 3.1 8B', 'meta', 'small', '2024-07-23', false, 0.1, 0.1, 4),
  ('muse-spark-1-2', 'meta/muse-spark-1.2', 'Muse Spark 1.2', 'meta', 'large', '2026-08-05', false, 1, 4, 3),
  ('muse-spark-1-1', 'meta/muse-spark-1.1', 'Muse Spark 1.1', 'meta', 'large', '2026-07-16', false, 1, 4, 4),
  ('llama-3-1-70b-instruct', 'meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'meta', 'medium', '2024-07-23', false, 0.4, 0.4, 4),
  ('llama-3-2-3b-instruct', 'meta-llama/llama-3.2-3b-instruct', 'Llama 3.2 3B', 'meta', 'nano', '2024-09-25', false, 0.1, 0.3, 4),
  ('gpt-6-astra', 'openai/gpt-6-astra', 'GPT-6 Astra', 'openai', 'large', '2026-09-04', false, 10, 50, 1),
  ('gpt-6-1-sol', 'openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'openai', 'medium', '2026-09-29', false, 2, 10, 1),
  ('gpt-6-sol', 'openai/gpt-6-sol', 'GPT-6 Sol', 'openai', 'medium', '2026-09-22', false, 2, 10, 2),
  ('gpt-6-luna', 'openai/gpt-6-luna', 'GPT-6 Luna', 'openai', 'small', '2026-09-22', false, 0.1, 0.5, 2),
  ('gpt-5-6-sol', 'openai/gpt-5.6-sol', 'GPT-5.6 Sol', 'openai', 'large', '2026-07-09', false, 2, 10, 3),
  ('gpt-5-6-terra', 'openai/gpt-5.6-terra', 'GPT-5.6 Terra', 'openai', 'medium', '2026-07-09', false, 2, 12, 4),
  ('gpt-5-6-luna', 'openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'openai', 'small', '2026-07-09', false, 0.2, 1, 3),
  ('gpt-5-5', 'openai/gpt-5.5', 'GPT-5.5', 'openai', 'large', '2026-04-24', false, 5, 30, 2),
  ('gpt-5-4', 'openai/gpt-5.4', 'GPT-5.4', 'openai', 'large', '2026-03-05', false, 3, 15, 3),
  ('gpt-5-4-mini', 'openai/gpt-5.4-mini', 'GPT-5.4 Mini', 'openai', 'small', '2026-03-17', false, 0.8, 5, 4),
  ('gpt-5-4-nano', 'openai/gpt-5.4-nano', 'GPT-5.4 Nano', 'openai', 'nano', '2026-03-17', false, 0.2, 1, 4),
  ('gpt-5-3-codex', 'openai/gpt-5.3-codex', 'GPT-5.3 Codex', 'openai', 'large', '2026-02-24', false, 2, 14, 4),
  ('gpt-5', 'openai/gpt-5', 'GPT-5', 'openai', 'large', '2025-08-07', false, 1, 10, 2),
  ('gpt-5-mini', 'openai/gpt-5-mini', 'GPT-5 Mini', 'openai', 'small', '2025-08-07', false, 0.3, 2, 4),
  ('gpt-5-nano', 'openai/gpt-5-nano', 'GPT-5 Nano', 'openai', 'nano', '2025-08-07', false, 0.1, 0.4, 4),
  ('gpt-oss-120b', 'openai/gpt-oss-120b', 'GPT-OSS 120B', 'openai', 'large', '2025-08-05', false, 0.04, 0.2, 4),
  ('gpt-oss-20b', 'openai/gpt-oss-20b', 'GPT-OSS 20B', 'openai', 'small', '2025-08-05', false, 0.02, 0.1, 4),
  ('o3', 'openai/o3', 'o3', 'openai', 'large', '2025-04-16', false, 2, 8, 2),
  ('o4-mini', 'openai/o4-mini', 'o4 Mini', 'openai', 'small', '2025-04-16', false, 1, 4, 4),
  ('o1', 'openai/o1', 'o1', 'openai', 'large', '2024-12-17', false, 15, 60, 3),
  ('gpt-4-1', 'openai/gpt-4.1', 'GPT-4.1', 'openai', 'large', '2025-04-14', false, 2, 8, 3),
  ('gpt-4-1-mini', 'openai/gpt-4.1-mini', 'GPT-4.1 Mini', 'openai', 'small', '2025-04-14', false, 0.4, 2, 4),
  ('gpt-4-1-nano', 'openai/gpt-4.1-nano', 'GPT-4.1 Nano', 'openai', 'nano', '2025-04-14', false, 0.1, 0.4, 4),
  ('gpt-4o', 'openai/gpt-4o', 'GPT-4o', 'openai', 'large', '2024-05-13', false, 3, 10, 2),
  ('gpt-4o-mini', 'openai/gpt-4o-mini', 'GPT-4o mini', 'openai', 'small', '2024-07-18', false, 0.2, 0.6, 3),
  ('gpt-4-turbo', 'openai/gpt-4-turbo', 'GPT-4 Turbo', 'openai', 'large', '2024-04-09', false, 10, 30, 3),
  ('gpt-4', 'openai/gpt-4', 'GPT-4', 'openai', 'large', '2023-05-28', false, 30, 60, 2),
  ('gpt-3-5-turbo', 'openai/gpt-3.5-turbo', 'GPT-3.5 Turbo', 'openai', 'small', '2023-05-28', false, 0.5, 2, 1),
  ('gpt-5-2', 'openai/gpt-5.2', 'GPT-5.2', 'openai', 'large', '2025-12-10', false, 2, 14, 3),
  ('gpt-5-2-chat', 'openai/gpt-5.2-chat', 'GPT-5.2 Chat', 'openai', 'small', '2025-12-10', false, 2, 14, 4),
  ('gpt-5-1', 'openai/gpt-5.1', 'GPT-5.1', 'openai', 'large', '2025-11-13', false, 1, 10, 3),
  ('gpt-5-2-codex', 'openai/gpt-5.2-codex', 'GPT-5.2 Codex', 'openai', 'large', '2026-01-14', false, 2, 14, 4),
  ('gpt-5-1-codex', 'openai/gpt-5.1-codex', 'GPT-5.1 Codex', 'openai', 'large', '2025-11-13', false, 1, 10, 4),
  ('gpt-5-1-codex-mini', 'openai/gpt-5.1-codex-mini', 'GPT-5.1 Codex Mini', 'openai', 'small', '2025-11-13', false, 0.3, 2, 4),
  ('o3-mini', 'openai/o3-mini', 'o3 Mini', 'openai', 'small', '2025-01-31', false, 1, 4, 4),
  ('sonar', 'perplexity/sonar', 'Sonar', 'perplexity', 'small', '2025-01-27', false, 1, 1, 3),
  ('sonar-pro', 'perplexity/sonar-pro', 'Sonar Pro', 'perplexity', 'medium', '2025-03-07', false, 3, 15, 2),
  ('sonar-reasoning-pro', 'perplexity/sonar-reasoning-pro', 'Sonar Reasoning Pro', 'perplexity', 'large', '2025-03-07', false, 2, 8, 3),
  ('sonar-deep-research', 'perplexity/sonar-deep-research', 'Sonar Deep Research', 'perplexity', 'large', '2025-03-07', false, 2, 8, 2),
  ('grok-4-7', 'x-ai/grok-4.7', 'Grok 4.7', 'xai', 'large', '2026-09-21', false, 2, 6, 1),
  ('grok-build-0-1', 'x-ai/grok-build-0.1', 'Grok Build 0.1', 'xai', 'small', '2026-05-20', false, 1, 2, 4),
  ('grok-4-6', 'x-ai/grok-4.6', 'Grok 4.6', 'xai', 'large', '2026-08-12', false, 2, 6, 2),
  ('grok-4-5', 'x-ai/grok-4.5', 'Grok 4.5', 'xai', 'large', '2026-07-08', false, 2, 6, 3),
  ('grok-4-3', 'x-ai/grok-4.3', 'Grok 4.3', 'xai', 'large', '2026-04-30', false, 1, 3, 4),
  ('grok-4-20', 'x-ai/grok-4.20', 'Grok 4.20', 'xai', 'large', '2026-03-31', false, 1, 3, 3),
  ('qwen3-8-max-0902', 'qwen/qwen3.8-max-0902', 'Qwen3.8 Max', 'alibaba', 'large', '2026-09-03', false, 2, 6, 1),
  ('qwen3-8-flash', 'qwen/qwen3.8-flash', 'Qwen3.8 Flash', 'alibaba', 'small', '2026-08-26', false, 0.2, 0.5, 2),
  ('qwen3-8-27b', 'qwen/qwen3.8-27b', 'Qwen3.8 27B', 'alibaba', 'small', '2026-08-14', false, 0.04, 2, 4),
  ('qwen3-7-max', 'qwen/qwen3.7-max', 'Qwen3.7 Max', 'alibaba', 'large', '2026-05-21', false, 1, 4, 2),
  ('qwen3-5-plus-20260420', 'qwen/qwen3.5-plus-20260420', 'Qwen3.5 Plus', 'alibaba', 'medium', '2026-04-27', false, 0.3, 2, 4),
  ('qwen3-5-flash-02-23', 'qwen/qwen3.5-flash-02-23', 'Qwen3.5 Flash', 'alibaba', 'small', '2026-02-25', false, 0.1, 0.3, 4),
  ('qwen3-235b-a22b-2507', 'qwen/qwen3-235b-a22b-2507', 'Qwen3 235B', 'alibaba', 'large', '2025-07-21', false, 0.1, 0.6, 3),
  ('qwen-2-5-72b-instruct', 'qwen/qwen-2.5-72b-instruct', 'Qwen2.5 72B', 'alibaba', 'medium', '2024-09-19', false, 0.4, 0.4, 4),
  ('qwen3-7-plus', 'qwen/qwen3.7-plus', 'Qwen3.7 Plus', 'alibaba', 'medium', '2026-06-03', false, 0.3, 1, 3),
  ('qwen3-7-flash', 'qwen/qwen3.7-flash', 'Qwen3.7 Flash', 'alibaba', 'small', '2026-07-27', false, 0.03, 0.1, 4),
  ('qwen3-6-plus', 'qwen/qwen3.6-plus', 'Qwen3.6 Plus', 'alibaba', 'medium', '2026-04-02', false, 0.3, 2, 4),
  ('qwen3-6-flash', 'qwen/qwen3.6-flash', 'Qwen3.6 Flash', 'alibaba', 'small', '2026-04-27', false, 0.2, 1, 4),
  ('qwen3-6-27b', 'qwen/qwen3.6-27b', 'Qwen3.6 27B', 'alibaba', 'small', '2026-04-27', false, 0.3, 3, 4),
  ('qwen3-5-397b-a17b', 'qwen/qwen3.5-397b-a17b', 'Qwen3.5 397B', 'alibaba', 'large', '2026-02-16', false, 0.6, 4, 3),
  ('qwen3-coder-next', 'qwen/qwen3-coder-next', 'Qwen3 Coder Next', 'alibaba', 'large', '2026-02-04', false, 0.1, 0.8, 4),
  ('qwen3-coder', 'qwen/qwen3-coder', 'Qwen3 Coder', 'alibaba', 'large', '2025-07-23', false, 0.3, 1, 4),
  ('qwen3-coder-flash', 'qwen/qwen3-coder-flash', 'Qwen3 Coder Flash', 'alibaba', 'small', '2025-09-17', false, 0.2, 1, 4),
  ('qwen3-next-80b-a3b-instruct', 'qwen/qwen3-next-80b-a3b-instruct', 'Qwen3 Next 80B', 'alibaba', 'medium', '2025-09-11', false, 0.1, 1, 4),
  ('qwen-2-5-7b-instruct', 'qwen/qwen-2.5-7b-instruct', 'Qwen2.5 7B', 'alibaba', 'small', '2024-10-16', false, 0.1, 0.2, 4),
  ('qwen-2-5-coder-32b-instruct', 'qwen/qwen-2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B', 'alibaba', 'medium', '2024-11-11', false, 0.7, 1, 4),
  ('qwen-plus', 'qwen/qwen-plus', 'Qwen-Plus', 'alibaba', 'medium', '2025-02-01', false, 0.3, 0.8, 4),
  ('deepseek-v4-1-flash', 'deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'deepseek', 'small', '2026-09-10', false, 0.3, 1, 2),
  ('deepseek-v4-pro-0813', 'deepseek/deepseek-v4-pro-0813', 'DeepSeek V4 Pro', 'deepseek', 'large', '2026-08-12', false, 0.7, 2, 1),
  ('deepseek-v3-2', 'deepseek/deepseek-v3.2', 'DeepSeek V3.2', 'deepseek', 'large', '2025-12-01', false, 0.3, 0.8, 3),
  ('deepseek-r1-0528', 'deepseek/deepseek-r1-0528', 'DeepSeek R1', 'deepseek', 'large', '2025-05-28', false, 0.5, 2, 2),
  ('deepseek-v4-flash-0731', 'deepseek/deepseek-v4-flash-0731', 'DeepSeek V4 Flash', 'deepseek', 'small', '2026-07-31', false, 0.02, 0.6, 3),
  ('deepseek-chat-v3-1', 'deepseek/deepseek-chat-v3.1', 'DeepSeek V3.1', 'deepseek', 'large', '2025-08-21', false, 0.3, 1, 4),
  ('deepseek-chat', 'deepseek/deepseek-chat', 'DeepSeek V3', 'deepseek', 'large', '2024-12-26', false, 0.3, 0.9, 2),
  ('kimi-k3', 'moonshotai/kimi-k3', 'Kimi K3', 'moonshot', 'large', '2026-07-16', false, 0.8, 10, 2),
  ('kimi-k2-6', 'moonshotai/kimi-k2.6', 'Kimi K2.6', 'moonshot', 'large', '2026-04-20', false, 0.7, 3, 4),
  ('kimi-k2-7-code', 'moonshotai/kimi-k2.7-code', 'Kimi K2.7 Code', 'moonshot', 'large', '2026-06-12', false, 0.7, 3, 4),
  ('kimi-k2-5', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 'moonshot', 'large', '2026-01-27', false, 0.5, 3, 3),
  ('kimi-k2-thinking', 'moonshotai/kimi-k2-thinking', 'Kimi K2 Thinking', 'moonshot', 'large', '2025-11-06', false, 0.6, 3, 3),
  ('kimi-k2', 'moonshotai/kimi-k2', 'Kimi K2', 'moonshot', 'large', '2025-07-11', false, 0.6, 2, 2),
  ('glm-5-3', 'z-ai/glm-5.3', 'GLM 5.3', 'zai', 'large', '2026-08-18', false, 0.1, 5, 2),
  ('glm-5-3-flash', 'z-ai/glm-5.3-flash', 'GLM 5.3 Flash', 'zai', 'small', '2026-08-26', false, 0.2, 0.5, 3),
  ('glm-4-7', 'z-ai/glm-4.7', 'GLM 4.7', 'zai', 'large', '2025-12-22', false, 0.6, 2, 3),
  ('glm-4-7-flash', 'z-ai/glm-4.7-flash', 'GLM 4.7 Flash', 'zai', 'small', '2026-01-19', false, 0.1, 0.4, 4),
  ('glm-5-2', 'z-ai/glm-5.2', 'GLM 5.2', 'zai', 'large', '2026-06-16', false, 0.1, 7, 3),
  ('glm-5-1', 'z-ai/glm-5.1', 'GLM 5.1', 'zai', 'large', '2026-04-07', false, 1, 3, 4),
  ('glm-5', 'z-ai/glm-5', 'GLM 5', 'zai', 'large', '2026-02-11', false, 0.6, 2, 3),
  ('glm-4-6', 'z-ai/glm-4.6', 'GLM 4.6', 'zai', 'large', '2025-09-30', false, 0.5, 2, 4),
  ('glm-4-5', 'z-ai/glm-4.5', 'GLM 4.5', 'zai', 'large', '2025-07-25', false, 0.6, 2, 4),
  ('glm-4-5-air', 'z-ai/glm-4.5-air', 'GLM 4.5 Air', 'zai', 'small', '2025-07-25', false, 0.1, 0.9, 4),
  ('mistral-large-4-0', 'mistralai/mistral-large-4-0', 'Mistral Large 4', 'mistral', 'large', '2026-10-06', false, 0.7, 2, 1),
  ('mistral-large-2512', 'mistralai/mistral-large-2512', 'Mistral Large 3', 'mistral', 'large', '2025-12-01', false, 0.5, 2, 3),
  ('mistral-medium-3-5', 'mistralai/mistral-medium-3-5', 'Mistral Medium 3.5', 'mistral', 'medium', '2026-04-30', false, 2, 8, 2),
  ('mistral-small-2603', 'mistralai/mistral-small-2603', 'Mistral Small 4', 'mistral', 'small', '2026-03-16', false, 0.2, 0.6, 2),
  ('ministral-14b-2512', 'mistralai/ministral-14b-2512', 'Ministral 3 14B', 'mistral', 'small', '2025-12-02', false, 0.2, 0.2, 4),
  ('devstral-2512', 'mistralai/devstral-2512', 'Devstral 2', 'mistral', 'medium', '2025-12-09', false, 0.4, 2, 4),
  ('mixtral-8x22b-instruct', 'mistralai/mixtral-8x22b-instruct', 'Mixtral 8x22B', 'mistral', 'large', '2024-04-17', false, 2, 6, 4),
  ('mistral-large-2407', 'mistralai/mistral-large-2407', 'Mistral Large 2', 'mistral', 'large', '2024-11-19', false, 2, 6, 3),
  ('mistral-medium-3-1', 'mistralai/mistral-medium-3.1', 'Mistral Medium 3.1', 'mistral', 'medium', '2025-08-13', false, 0.4, 2, 4),
  ('mistral-medium-3', 'mistralai/mistral-medium-3', 'Mistral Medium 3', 'mistral', 'medium', '2025-05-07', false, 0.4, 2, 3),
  ('mistral-small-3-2-24b-instruct', 'mistralai/mistral-small-3.2-24b-instruct', 'Mistral Small 3.2', 'mistral', 'small', '2025-06-20', false, 0.1, 0.3, 3),
  ('mistral-small-3-1-24b-instruct', 'mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1', 'mistral', 'small', '2025-03-17', false, 0.4, 0.6, 4),
  ('mistral-small-24b-instruct-2501', 'mistralai/mistral-small-24b-instruct-2501', 'Mistral Small 3', 'mistral', 'small', '2025-01-30', false, 0.1, 0.1, 4),
  ('codestral-2508', 'mistralai/codestral-2508', 'Codestral', 'mistral', 'medium', '2025-08-01', false, 0.3, 0.9, 4),
  ('mistral-nemo', 'mistralai/mistral-nemo', 'Mistral Nemo', 'mistral', 'small', '2024-07-19', false, 0.03, 0.03, 4);
