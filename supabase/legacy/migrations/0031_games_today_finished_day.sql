-- Games today counts a finished round on the UTC day it finished.
-- A round started yesterday and finished today counts today.
-- A round started today that finishes tomorrow does not count today.
-- A round with finished_at null never counts.
-- Models and players stay as they were.

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
