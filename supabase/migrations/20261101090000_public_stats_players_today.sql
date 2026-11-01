-- public_stats() also returns how many distinct accounts finished a round during the current UTC day.
create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'models', (select count(*)::int from public.models where enabled),
    'companies', (
      select count(distinct company_id)::int
      from public.models
      where enabled
    ),
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
    ),
    'playersToday', (
      select count(distinct user_id)::int
      from public.games
      where finished_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
        and finished_at < (date_trunc('day', now() at time zone 'utc') at time zone 'utc') + interval '1 day'
        and user_id is not null
    )
  );
$$;
