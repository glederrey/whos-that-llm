-- One unfinished round per account, mode, and difficulty.
-- Easy can stay open while Medium starts. A second Easy of that mode cannot.
-- Daily and All models are separate, so each can have its own open Easy.
-- This replaces games_one_active_idx, which allowed only one active row per account.
-- It does not delete or rewrite games, models, profiles, or accounts.

drop index if exists public.games_one_active_idx;

create unique index games_one_active_per_difficulty_idx
  on public.games (user_id, game_mode, difficulty)
  where status = 'active';

comment on index public.games_one_active_per_difficulty_idx is
  'One active round per account, game mode, and difficulty. A different difficulty can start.';

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

  select id into new_id
  from public.games
  where user_id = p_user_id
    and status = 'active'
    and game_mode = p_game_mode
    and difficulty is not distinct from p_difficulty
  limit 1;
  if new_id is not null then
    return jsonb_build_object('ok', false, 'error', 'active_game', 'gameId', new_id);
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
    select id into new_id
    from public.games
    where user_id = p_user_id
      and status = 'active'
      and game_mode = p_game_mode
      and difficulty is not distinct from p_difficulty
    limit 1;
    if new_id is not null then
      return jsonb_build_object('ok', false, 'error', 'active_game', 'gameId', new_id);
    end if;
    return jsonb_build_object('ok', false, 'error', 'active_game');
end;
$$;

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) to service_role;
