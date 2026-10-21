-- Difficulty on each roster model, and the difficulty a round was played at.
-- Stored as smallint: 1 easy, 2 medium, 3 hard, 4 impossible.
-- A round played at X draws enabled models whose difficulty is <= X.
-- The update classifies every current model. It does not change enabled.

alter table public.models
  add column difficulty smallint;

update public.models as m
set difficulty = v.difficulty
from (values
  ('qwen3-8-max-0902', 1),
  ('claude-sonnet-5-5', 1),
  ('claude-opus-5-5', 1),
  ('deepseek-v4-pro-0813', 1),
  ('gemini-3-1-pro-preview', 1),
  ('gemini-3-8-flash', 1),
  ('llama-4-maverick', 1),
  ('mistral-large-4-0', 1),
  ('gpt-6-astra', 1),
  ('gpt-6-1-sol', 1),
  ('gpt-3-5-turbo', 1),
  ('grok-4-7', 1),
  ('qwen3-8-flash', 2),
  ('qwen3-7-max', 2),
  ('claude-haiku-5-5', 2),
  ('claude-opus-5', 2),
  ('claude-sonnet-5', 2),
  ('deepseek-v4-1-flash', 2),
  ('deepseek-chat', 2),
  ('deepseek-r1-0528', 2),
  ('gemini-2-5-pro', 2),
  ('llama-4-scout', 2),
  ('mistral-medium-3-5', 2),
  ('mistral-small-2603', 2),
  ('kimi-k3', 2),
  ('kimi-k2', 2),
  ('gpt-6-luna', 2),
  ('gpt-6-sol', 2),
  ('gpt-5-5', 2),
  ('gpt-5', 2),
  ('gpt-4o', 2),
  ('o3', 2),
  ('gpt-4', 2),
  ('sonar-pro', 2),
  ('sonar-deep-research', 2),
  ('grok-4-6', 2),
  ('glm-5-3', 2),
  ('qwen3-235b-a22b-2507', 3),
  ('qwen3-5-397b-a17b', 3),
  ('qwen3-7-plus', 3),
  ('claude-haiku-4-5', 3),
  ('claude-opus-4-1', 3),
  ('claude-opus-4-5', 3),
  ('claude-opus-4-8', 3),
  ('claude-sonnet-4', 3),
  ('claude-sonnet-4-5', 3),
  ('claude-sonnet-4-6', 3),
  ('deepseek-v3-2', 3),
  ('deepseek-v4-flash-0731', 3),
  ('gemini-2-5-flash', 3),
  ('gemini-3-flash-preview', 3),
  ('gemini-3-7-flash', 3),
  ('llama-3-3-70b-instruct', 3),
  ('muse-spark-1-2', 3),
  ('muse-spark-1-3', 3),
  ('mistral-large-2407', 3),
  ('mistral-large-2512', 3),
  ('mistral-medium-3', 3),
  ('mistral-small-3-2-24b-instruct', 3),
  ('kimi-k2-thinking', 3),
  ('kimi-k2-5', 3),
  ('gpt-4-turbo', 3),
  ('gpt-4-1', 3),
  ('gpt-4o-mini', 3),
  ('gpt-5-1', 3),
  ('gpt-5-2', 3),
  ('gpt-5-4', 3),
  ('gpt-5-6-luna', 3),
  ('gpt-5-6-sol', 3),
  ('o1', 3),
  ('sonar', 3),
  ('sonar-reasoning-pro', 3),
  ('grok-4-20', 3),
  ('grok-4-5', 3),
  ('glm-4-7', 3),
  ('glm-5', 3),
  ('glm-5-2', 3),
  ('glm-5-3-flash', 3),
  ('qwen-plus', 4),
  ('qwen-2-5-7b-instruct', 4),
  ('qwen-2-5-72b-instruct', 4),
  ('qwen-2-5-coder-32b-instruct', 4),
  ('qwen3-coder', 4),
  ('qwen3-coder-flash', 4),
  ('qwen3-coder-next', 4),
  ('qwen3-next-80b-a3b-instruct', 4),
  ('qwen3-5-flash-02-23', 4),
  ('qwen3-5-plus-20260420', 4),
  ('qwen3-6-flash', 4),
  ('qwen3-6-plus', 4),
  ('qwen3-6-27b', 4),
  ('qwen3-7-flash', 4),
  ('qwen3-8-27b', 4),
  ('claude-fable-5', 4),
  ('claude-fable-5-1', 4),
  ('claude-opus-4-6', 4),
  ('claude-opus-4-7', 4),
  ('deepseek-chat-v3-1', 4),
  ('gemini-2-5-flash-lite', 4),
  ('gemini-3-1-flash-lite', 4),
  ('gemini-3-5-flash', 4),
  ('gemini-3-5-flash-lite', 4),
  ('gemini-3-6-flash', 4),
  ('gemma-2-27b-it', 4),
  ('gemma-3-27b-it', 4),
  ('gemma-4-31b-it', 4),
  ('llama-3-1-8b-instruct', 4),
  ('llama-3-1-70b-instruct', 4),
  ('llama-3-2-3b-instruct', 4),
  ('muse-glimmer-30b', 4),
  ('muse-spark-1-1', 4),
  ('codestral-2508', 4),
  ('devstral-2512', 4),
  ('ministral-14b-2512', 4),
  ('mistral-medium-3-1', 4),
  ('mistral-nemo', 4),
  ('mistral-small-24b-instruct-2501', 4),
  ('mistral-small-3-1-24b-instruct', 4),
  ('mixtral-8x22b-instruct', 4),
  ('kimi-k2-6', 4),
  ('kimi-k2-7-code', 4),
  ('gpt-4-1-mini', 4),
  ('gpt-4-1-nano', 4),
  ('gpt-5-mini', 4),
  ('gpt-5-nano', 4),
  ('gpt-5-1-codex', 4),
  ('gpt-5-1-codex-mini', 4),
  ('gpt-5-2-chat', 4),
  ('gpt-5-2-codex', 4),
  ('gpt-5-3-codex', 4),
  ('gpt-5-4-mini', 4),
  ('gpt-5-4-nano', 4),
  ('gpt-5-6-terra', 4),
  ('gpt-oss-120b', 4),
  ('gpt-oss-20b', 4),
  ('o3-mini', 4),
  ('o4-mini', 4),
  ('grok-4-3', 4),
  ('grok-build-0-1', 4),
  ('glm-4-5', 4),
  ('glm-4-5-air', 4),
  ('glm-4-6', 4),
  ('glm-4-7-flash', 4),
  ('glm-5-1', 4)
) as v(id, difficulty)
where m.id = v.id;

do $$
begin
  if exists (select 1 from public.models where difficulty is null) then
    raise exception 'every model needs a difficulty before the column can be required';
  end if;
end $$;

alter table public.models
  alter column difficulty set not null;

alter table public.models
  add constraint models_difficulty_check
  check (difficulty between 1 and 4);

alter table public.games
  add column difficulty smallint;

alter table public.games
  add constraint games_difficulty_check
  check (difficulty is null or difficulty between 1 and 4);

drop function if exists public.leaderboard(text, timestamptz, uuid);
drop function if exists public.leaderboard(text, timestamptz, uuid, text);

create function public.leaderboard(category text, since timestamptz, viewer uuid default null, p_difficulty smallint default null)
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
    join public.categories c on c.id = g.category
    where c.leaderboard
      and g.user_id is not null
      and g.username is not null
      and btrim(g.username) <> ''
      and g.category = leaderboard.category
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

drop function if exists public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb);
drop function if exists public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, text);

create function public.start_game(
  p_user_id uuid,
  p_hourly_cap int,
  p_category text,
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

  if p_difficulty is not null and (p_difficulty < 1 or p_difficulty > 4) then
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
    user_id, username, category, pool_key, difficulty, pool_model_ids, model_id, traits,
    status, no_hint, rules, hints, message_count, awaiting_guess
  ) values (
    p_user_id, profile_name, p_category, p_pool_key, p_difficulty, p_pool_model_ids, p_model_id, p_traits,
    'active', no_hint, rules, '{}', 0, false
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'gameId', new_id);
end;
$$;

revoke all on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.start_game(uuid, int, text, text, boolean, text, text[], jsonb, jsonb, smallint) to service_role;
