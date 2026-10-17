-- Company is playable. The player picks one company, the same way Daily and
-- All models pick a difficulty. The leaderboard for Company filters by that
-- company instead of by difficulty, and each row can name the company.
-- One unfinished round per account and company.
-- Category moves below Company. Category, Region, and Custom stay closed.
-- This does not delete or rewrite games, models, profiles, or accounts.

update public.game_modes
set sort_order = 4
where id = 'class';

update public.game_modes
set
  enabled = true,
  leaderboard = true,
  sort_order = 3
where id = 'company';

create unique index if not exists games_one_active_per_company_idx
  on public.games (user_id, game_mode, pool_key)
  where status = 'active' and game_mode = 'company' and pool_key is not null;

comment on index public.games_one_active_per_company_idx is
  'One active Company round per account and company. A different company can start.';

drop function if exists public.leaderboard(text, timestamptz, uuid, smallint);

create function public.leaderboard(
  game_mode text,
  since timestamptz,
  viewer uuid default null,
  p_difficulty smallint default null,
  p_company text default null
)
returns table (
  rank bigint,
  name text,
  score int,
  mine boolean,
  user_id uuid,
  avatar_path text,
  difficulty smallint,
  no_hint boolean,
  company_id text,
  company_name text,
  company_logo text
)
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
           g.no_hint,
           g.pool_key
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
        case
          when leaderboard.game_mode = 'company' then
            g.pool_key is not null
            and (
              leaderboard.p_company is null
              or btrim(leaderboard.p_company) = ''
              or g.pool_key = leaderboard.p_company
            )
          else
            (leaderboard.p_difficulty is null and g.difficulty is not null)
            or g.difficulty = leaderboard.p_difficulty
        end
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
         best.no_hint,
         case when leaderboard.game_mode = 'company' then best.pool_key else null end as company_id,
         case when leaderboard.game_mode = 'company' then co.name else null end as company_name,
         case when leaderboard.game_mode = 'company' then co.logo_path else null end as company_logo
  from best
  left join public.profiles p on p.id = best.user_id
  left join public.companies co on co.id = best.pool_key
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;

revoke all on function public.leaderboard(text, timestamptz, uuid, smallint, text) from public;
grant execute on function public.leaderboard(text, timestamptz, uuid, smallint, text) to anon, authenticated, service_role;

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
    and pool_key is not distinct from p_pool_key
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
      and pool_key is not distinct from p_pool_key
    limit 1;
    if new_id is not null then
      return jsonb_build_object('ok', false, 'error', 'active_game', 'gameId', new_id);
    end if;
    return jsonb_build_object('ok', false, 'error', 'active_game');
end;
$$;
