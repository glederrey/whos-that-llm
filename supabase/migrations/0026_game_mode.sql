-- The game mode (Daily, All models, Class, Company, Region, Custom) frees the
-- name category. games.category becomes game_mode, and the mode catalog
-- categories becomes game_modes. Model-set tables stay as they are.

alter table public.categories rename to game_modes;
alter table public.games rename column category to game_mode;
alter policy categories_read on public.game_modes rename to game_modes_read;

drop function if exists public.leaderboard(text, timestamptz, uuid, smallint);

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

grant execute on function public.leaderboard(text, timestamptz, uuid, smallint) to anon, authenticated, service_role;

drop function if exists public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint);

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

  select * into game_mode_row from public.game_modes where id = p_game_mode;
  if not found or not game_mode_row.enabled then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_difficulty is not null and (p_difficulty < 1 or p_difficulty > 4) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_game_mode = 'daily' and exists (
    select 1 from public.games
    where user_id = p_user_id and daily_key = (timezone('utc', now()))::date
  ) then
    return jsonb_build_object('ok', false, 'error', 'daily_done');
  end if;

  rules := p_rules || jsonb_build_object('hintsAllowed', game_mode_row.hints_allowed);
  no_hint := p_no_hint;
  if p_game_mode = 'origin' then
    rules := rules || jsonb_build_object('hintsAllowed', false);
    no_hint := false;
  end if;

  insert into public.games (
    user_id, username, game_mode, pool_key, difficulty, pool_model_ids, model_id, traits,
    status, no_hint, rules, hints, message_count, awaiting_guess
  ) values (
    p_user_id, profile_name, p_game_mode, p_pool_key, p_difficulty, p_pool_model_ids, p_model_id, p_traits,
    'active', no_hint, rules, '{}', 0, false
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'gameId', new_id);
end;
$$;

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) to service_role;
