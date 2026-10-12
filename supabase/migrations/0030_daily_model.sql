-- Daily is the same round as All models, once per difficulty per account per UTC day.
-- The hidden model is shared: one row per difficulty per UTC day.
-- games.daily_key was a date, so the unique (user_id, daily_key) pair could not
-- tell Easy from Medium. It is now text, "YYYY-MM-DD:1" through ":4".
-- That same unique pair allows Easy and Medium on one day and refuses a second Easy.
-- start_game used to check daily_key and then insert without writing it.
-- This does not delete or rewrite games, models, profiles, or accounts.
-- Existing dates, if any, become their text form. Nulls stay null.

alter table public.games
  alter column daily_key type text using daily_key::text;

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

alter table public.daily_models enable row level security;

create policy daily_models_no_client on public.daily_models
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.daily_models from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_models to service_role;

create or replace function public.start_game(
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

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) to service_role;

update public.game_modes set enabled = true where id = 'daily';
