-- Who's that LLM. Paste this once in the Supabase SQL editor.
-- Re-running is safe: tables use IF NOT EXISTS, and the seed does not overwrite rows.

create table if not exists public.companies (
  id text primary key,
  name text not null,
  region text not null check (region in ('us', 'cn', 'eu')),
  logo_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id text primary key,
  name text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.models (
  id text primary key,
  openrouter_id text not null unique,
  name text not null,
  company_id text not null references public.companies (id),
  family_id text not null references public.families (id),
  size text not null check (size in ('small', 'medium', 'large')),
  open_weights boolean not null default false,
  reasoning boolean not null default false,
  provider_settings jsonb not null default '{}'::jsonb,
  is_latest boolean not null default false,
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

create table if not exists public.categories (
  id text primary key,
  name text not null,
  blurb text not null,
  enabled boolean not null default false,
  leaderboard boolean not null default false,
  hints_allowed boolean not null default false,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id int primary key check (id = 1),
  paused boolean not null default false
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  constraint username_len check (
    username is null
    or (
      char_length(btrim(username)) between 3 and 20
      and username = btrim(username)
      and username !~ '[\n\r]'
    )
  )
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  username text not null,
  category text not null references public.categories (id),
  pool_key text,
  pool_model_ids text[] not null,
  model_id text not null references public.models (id),
  traits jsonb not null,
  status text not null check (status in ('active', 'solved', 'miss', 'given_up')),
  no_hint boolean not null default false,
  rules jsonb not null,
  hints text[] not null default '{}',
  message_count int not null default 0 check (message_count between 0 and 5),
  awaiting_guess boolean not null default false,
  score int,
  score_breakdown jsonb,
  score_explanation text[],
  daily_key date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  call_started_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null check (turn between 1 and 5),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (game_id, turn, role)
);

create table if not exists public.guesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null,
  guessed_model_id text references public.models (id),
  guessed_region text check (guessed_region in ('us', 'cn', 'eu')),
  model_correct boolean not null,
  company_correct boolean not null,
  family_correct boolean not null,
  region_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (game_id, turn)
);

create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete cascade,
  user_id uuid not null,
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

create index if not exists games_user_started_idx on public.games (user_id, started_at desc);
create unique index if not exists games_one_active_idx on public.games (user_id) where status = 'active';
create unique index if not exists games_daily_idx on public.games (user_id, daily_key) where daily_key is not null;
create index if not exists games_leaderboard_idx on public.games (category, status, finished_at);

create or replace view public.models_public as
  select id, name, company_id, logo_path
  from public.models
  where enabled;

create or replace function public.handle_new_user()
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.leaderboard(category text, since timestamptz)
returns table (rank bigint, name text, score int)
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
           g.finished_at
    from public.games g
    join public.categories c on c.id = g.category
    where c.leaderboard
      and g.category = leaderboard.category
      and g.status in ('solved', 'miss')
      and g.score is not null
      and g.finished_at is not null
      and g.finished_at >= leaderboard.since
    order by g.user_id, g.score desc, g.message_count asc, g.finished_at asc
  )
  select row_number() over (
           order by best.score desc, best.message_count asc, best.finished_at asc, best.username
         )::bigint as rank,
         best.username as name,
         best.score
  from best
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;

create or replace function public.start_game(
  p_user_id uuid,
  p_hourly_cap int,
  p_category text,
  p_pool_key text,
  p_no_hint boolean,
  p_model_id text,
  p_pool_model_ids text[],
  p_traits jsonb,
  p_rules jsonb
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
  category_row public.categories%rowtype;
  rules jsonb;
  no_hint boolean;
  new_id uuid;
begin
  if coalesce((select paused from public.app_settings where id = 1), false) then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;

  select username into profile_name from public.profiles where id = p_user_id for update;
  if profile_name is null then
    return jsonb_build_object('ok', false, 'error', 'username');
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

  select * into category_row from public.categories where id = p_category;
  if not found or not category_row.enabled then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_category = 'daily' and exists (
    select 1 from public.games
    where user_id = p_user_id and daily_key = (timezone('utc', now()))::date
  ) then
    return jsonb_build_object('ok', false, 'error', 'daily_done');
  end if;

  rules := p_rules || jsonb_build_object('hintsAllowed', category_row.hints_allowed);
  no_hint := p_no_hint;
  if p_category = 'origin' then
    rules := rules || jsonb_build_object('hintsAllowed', false);
    no_hint := false;
  end if;

  insert into public.games (
    user_id, username, category, pool_key, pool_model_ids, model_id, traits,
    status, no_hint, rules, hints, message_count, awaiting_guess
  ) values (
    p_user_id, profile_name, p_category, p_pool_key, p_pool_model_ids, p_model_id, p_traits,
    'active', no_hint, rules, '{}', 0, false
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'gameId', new_id);
end;
$$;

create or replace function public.claim_model_call(p_game_id uuid, p_user_id uuid)
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
  limit_count := coalesce((g.rules ->> 'messageLimit')::int, 5);
  if g.status <> 'active' or g.awaiting_guess or g.message_count >= limit_count then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if g.call_started_at is not null and g.call_started_at > now() - interval '3 minutes' then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  update public.games set call_started_at = now() where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.apply_reply(
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

create or replace function public.abort_reply(
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
  update public.games set call_started_at = null where id = g.id;
  if p_pause then
    update public.app_settings set paused = true where id = 1;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.apply_guess(
  p_game_id uuid,
  p_user_id uuid,
  p_model_id text,
  p_region text,
  p_model_correct boolean,
  p_company_correct boolean,
  p_family_correct boolean,
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
  if p_finish = 'miss' and g.message_count < coalesce((g.rules ->> 'messageLimit')::int, 5) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if p_finish = 'continue' and (p_model_correct or g.message_count >= coalesce((g.rules ->> 'messageLimit')::int, 5)) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;

  insert into public.guesses (
    game_id, turn, guessed_model_id, guessed_region,
    model_correct, company_correct, family_correct, region_correct
  ) values (
    g.id, g.message_count, p_model_id, p_region,
    p_model_correct, p_company_correct, p_family_correct, p_region_correct
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

create or replace function public.apply_hint(
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
     or g.message_count = 0
     or g.no_hint
     or coalesce((g.rules ->> 'hintsAllowed')::boolean, false) = false
     or p_key not in ('year', 'size')
     or p_key = any (g.hints)
     or p_key = any (select jsonb_array_elements_text(g.traits -> 'given'))
  then
    return jsonb_build_object('ok', false, 'error', 'hint');
  end if;
  update public.games set hints = g.hints || array[p_key] where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.apply_give_up(
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

alter table public.companies enable row level security;
alter table public.families enable row level security;
alter table public.models enable row level security;
alter table public.categories enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.messages enable row level security;
alter table public.guesses enable row level security;
alter table public.usage enable row level security;

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to anon, authenticated using (true);
drop policy if exists families_read on public.families;
create policy families_read on public.families for select to anon, authenticated using (true);
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated using (enabled);
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_username on public.profiles;
create policy profiles_update_username on public.profiles
  for update to authenticated
  using (id = auth.uid() and username is null)
  with check (id = auth.uid());

grant select on public.companies, public.families, public.models_public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant execute on function public.leaderboard(text, timestamptz) to anon, authenticated;

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_model_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_reply(uuid, uuid, text, text, int, int, int, int, numeric, text) from public, anon, authenticated;
revoke all on function public.abort_reply(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, boolean, text, int, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.apply_hint(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_give_up(uuid, uuid, int, jsonb, text[]) from public, anon, authenticated;

grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb) to service_role;
grant execute on function public.claim_model_call(uuid, uuid) to service_role;
grant execute on function public.apply_reply(uuid, uuid, text, text, int, int, int, int, numeric, text) to service_role;
grant execute on function public.abort_reply(uuid, uuid, text, boolean) to service_role;
grant execute on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, boolean, text, int, jsonb, text[]) to service_role;
grant execute on function public.apply_hint(uuid, uuid, text) to service_role;
grant execute on function public.apply_give_up(uuid, uuid, int, jsonb, text[]) to service_role;

insert into public.app_settings (id, paused) values (1, false) on conflict (id) do nothing;

insert into public.companies (id, name, region, logo_path) values
  ('anthropic', 'Anthropic', 'us', '/logos/anthropic.svg'),
  ('openai', 'OpenAI', 'us', '/logos/openai.svg'),
  ('deepseek', 'DeepSeek', 'cn', '/logos/deepseek.svg'),
  ('mistral', 'Mistral', 'eu', '/logos/mistral.svg')
on conflict (id) do nothing;

insert into public.families (id, name, enabled) values
  ('opus', 'Opus', true),
  ('sonnet', 'Sonnet', true),
  ('haiku', 'Haiku', false),
  ('gpt', 'GPT', true),
  ('deepseek', 'DeepSeek', true),
  ('mistral', 'Mistral', true)
on conflict (id) do nothing;

insert into public.models (
  id, openrouter_id, name, company_id, family_id, size, open_weights, reasoning,
  provider_settings, is_latest, released_on, enabled, input_usd_per_mtok, output_usd_per_mtok
) values
  ('claude-opus-4-8', 'anthropic/claude-opus-4.8', 'Claude Opus 4.8', 'anthropic', 'opus', 'large', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-05-27', false, 5, 25),
  ('claude-opus-5-5', 'anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'anthropic', 'opus', 'large', false, true, '{"reasoning":{"effort":"low"}}', true, '2026-09-22', false, 4, 20),
  ('claude-sonnet-5', 'anthropic/claude-sonnet-5', 'Claude Sonnet 5', 'anthropic', 'sonnet', 'medium', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-06-30', false, 2, 10),
  ('claude-sonnet-5-5', 'anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5', 'anthropic', 'sonnet', 'medium', false, true, '{"reasoning":{"effort":"low"}}', true, '2026-09-28', false, 2, 10),
  ('claude-haiku-5-5', 'anthropic/claude-haiku-5.5', 'Claude Haiku 5.5', 'anthropic', 'haiku', 'small', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-10-07', true, 0.1, 0.5),
  ('gpt-5-6-luna', 'openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'openai', 'gpt', 'small', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-07-09', true, 0.2, 1.2),
  ('gpt-5-6-sol', 'openai/gpt-5.6-sol', 'GPT-5.6 Sol', 'openai', 'gpt', 'medium', false, true, '{"reasoning":{"effort":"low"}}', true, '2026-07-09', false, 2, 10),
  ('gpt-5-6-terra', 'openai/gpt-5.6-terra', 'GPT-5.6 Terra', 'openai', 'gpt', 'large', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-07-09', false, 2, 12),
  ('deepseek-v4-flash', 'deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek', 'deepseek', 'small', true, true, '{"reasoning":{"effort":"low"}}', false, '2026-04-24', true, 0.0099, 1.28),
  ('deepseek-v4-pro', 'deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', 'deepseek', 'large', true, true, '{"reasoning":{"effort":"low"}}', false, '2026-04-24', false, 0.2088, 0.4176),
  ('mistral-medium-3-5', 'mistralai/mistral-medium-3-5', 'Mistral Medium 3.5', 'mistral', 'mistral', 'medium', false, false, '{}', false, '2026-04-30', false, 1.5, 7.5),
  ('mistral-large-2512', 'mistralai/mistral-large-2512', 'Mistral Large 3', 'mistral', 'mistral', 'large', false, false, '{}', false, '2025-12-01', false, 0.5, 1.5)
on conflict (id) do nothing;

insert into public.categories (id, name, blurb, enabled, leaderboard, hints_allowed, sort_order) values
  ('all', 'All models', 'Any model in the roster. Name it, or take the region and the company.', true, true, true, 1),
  ('company', 'Company', 'The lab is already known. Name the model.', false, false, false, 2),
  ('family', 'Family', 'One family. Name the model.', false, false, false, 3),
  ('region', 'Region', 'USA, China, or Europe.', false, false, true, 4),
  ('latest', 'Latest', 'The newest model in each family.', false, false, false, 5),
  ('daily', 'Daily', 'The same model for everyone today.', false, true, true, 6),
  ('origin', 'Origin', 'USA, China, or Europe. One guess.', false, false, false, 7)
on conflict (id) do nothing;
