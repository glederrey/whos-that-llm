-- Ten messages, optional guesses, landing counts, and a leaderboard flag for the signed-in player.

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.games'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%message_count%';
  if cname is not null then
    execute format('alter table public.games drop constraint %I', cname);
  end if;

  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.messages'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%turn%';
  if cname is not null then
    execute format('alter table public.messages drop constraint %I', cname);
  end if;
end $$;

alter table public.games
  add constraint games_message_count_check check (message_count between 0 and 10);

alter table public.messages
  add constraint messages_turn_check check (turn between 1 and 10);

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
  if p_finish = 'miss' and g.message_count < coalesce((g.rules ->> 'messageLimit')::int, 10) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if p_finish = 'continue' and (p_model_correct or g.message_count >= coalesce((g.rules ->> 'messageLimit')::int, 10)) then
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

drop function if exists public.leaderboard(text, timestamptz);

create or replace function public.leaderboard(category text, since timestamptz, viewer uuid default null)
returns table (rank bigint, name text, score int, mine boolean)
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
         best.score,
         (leaderboard.viewer is not null and best.user_id = leaderboard.viewer) as mine
  from best
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;

create or replace function public.public_stats()
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
      where started_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    ),
    'players', (select count(distinct user_id)::int from public.games)
  );
$$;

grant execute on function public.leaderboard(text, timestamptz, uuid) to anon, authenticated, service_role;
grant execute on function public.public_stats() to anon, authenticated, service_role;
