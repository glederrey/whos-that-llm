-- Players counts a person only when they have finished at least one game.
-- An anonymized game has no user_id and does not count.

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
        and finished_at is not null
    ),
    'players', (
      select count(distinct user_id)::int
      from public.games
      where finished_at is not null
        and user_id is not null
    )
  );
$$;
