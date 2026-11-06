-- Faster leaderboard and statistics (GitHub issue 139). No table changes, no new table.

-- 1. Leaderboard. public.leaderboard() takes the best round of each player with
--    DISTINCT ON (user_id) ... ORDER BY user_id, score desc, message_count, finished_at,
--    over the finished, scored rounds of one mode. games_leaderboard_idx
--    (game_mode, status, finished_at) cannot give that order, so every call sorted the
--    whole mode. This partial index holds exactly those rows, already in the DISTINCT ON
--    order, and carries the columns the function reads so it can run as an index-only scan.
--    Its predicate repeats the function's own (status in ('solved','miss'), score and
--    user_id and finished_at not null), so the planner can use it for any call.
--    games_leaderboard_idx stays: it still wins for a short window (a day or a week).
create index if not exists games_leaderboard_best_idx
  on public.games (game_mode, user_id, score desc, message_count asc, finished_at asc)
  include (username, difficulty, no_hint, pool_key)
  where status in ('solved', 'miss')
    and score is not null
    and user_id is not null
    and finished_at is not null;

comment on index public.games_leaderboard_best_idx is
  'Serves public.leaderboard(): finished scored rounds per mode, in the DISTINCT ON (user_id) best-round order.';

-- 2. Statistics. /statistics used to read games, usage and guesses 1000 rows at a time
--    (hundreds of requests, one after the other). This function returns every finished
--    round in one call, as compact arrays, with usage and guesses already folded per round.
--    The server (service role) is the only caller. The figures are still computed in
--    lib/public-stats.ts from these facts.
--
--    games:   [n, model_id, status, message_count, started day, finished day, game_mode,
--              hidden size, hidden origin, pool_key, difficulty, no_hint, score, pool_model_ids]
--             n numbers the round (1..) and links the other two lists. pool_model_ids is only
--             filled for Custom rounds. size and origin come from games.traits for the hidden model.
--    usage:   [n, model_id, input + output tokens]  one row per round and model, rounds with a game only
--    guesses: [n, guesses, model_correct count, origin_correct count, origin of the last guess,
--              wrong guessed_model_id list]  one row per round that has guesses
create or replace function public.statistics_facts()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with g as (
    select row_number() over (order by x.id)::int as n, x.*
    from public.games x
    where x.finished_at is not null
  )
  select jsonb_build_object(
    'games', coalesce((
      select jsonb_agg(jsonb_build_array(
        g.n,
        g.model_id,
        g.status,
        g.message_count,
        to_char(g.started_at at time zone 'utc', 'YYYY-MM-DD'),
        to_char(g.finished_at at time zone 'utc', 'YYYY-MM-DD'),
        g.game_mode,
        case when jsonb_typeof(g.traits #> array['models', g.model_id, 'size']) = 'string'
             then g.traits #>> array['models', g.model_id, 'size'] end,
        case when jsonb_typeof(g.traits #> array['models', g.model_id, 'origin']) = 'string'
             then g.traits #>> array['models', g.model_id, 'origin'] end,
        g.pool_key,
        g.difficulty,
        g.no_hint,
        g.score,
        case when g.game_mode = 'custom' then to_jsonb(g.pool_model_ids) else '[]'::jsonb end
      )) from g
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(jsonb_build_array(g.n, u.model_id, u.tokens))
      from (
        select us.game_id, us.model_id, sum(us.input_tokens::bigint + us.output_tokens)::bigint as tokens
        from public.usage us
        where us.game_id is not null
        group by us.game_id, us.model_id
      ) u
      join g on g.id = u.game_id
    ), '[]'::jsonb),
    'guesses', coalesce((
      select jsonb_agg(jsonb_build_array(g.n, s.total, s.model_right, s.origin_right, s.last_origin, s.wrong))
      from (
        select gu.game_id,
               count(*)::int as total,
               (count(*) filter (where gu.model_correct))::int as model_right,
               (count(*) filter (where gu.origin_correct))::int as origin_right,
               (array_agg(gu.guessed_origin order by gu.turn desc))[1] as last_origin,
               coalesce(
                 jsonb_agg(gu.guessed_model_id) filter (where not gu.model_correct and gu.guessed_model_id is not null),
                 '[]'::jsonb
               ) as wrong
        from public.guesses gu
        group by gu.game_id
      ) s
      join g on g.id = s.game_id
    ), '[]'::jsonb)
  );
$$;

comment on function public.statistics_facts() is
  'Every finished round with its usage and guesses folded per round, as compact arrays. Read by lib/public-stats-data.ts with the service role.';

revoke all on function public.statistics_facts() from public, anon, authenticated;
grant execute on function public.statistics_facts() to service_role;
