-- The board keeps rank, name, and score, and adds the player's picture.

drop function if exists public.leaderboard(text, timestamptz, uuid);

create function public.leaderboard(category text, since timestamptz, viewer uuid default null)
returns table (rank bigint, name text, score int, mine boolean, user_id uuid, avatar_path text)
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
         (leaderboard.viewer is not null and best.user_id = leaderboard.viewer) as mine,
         best.user_id,
         p.avatar_path
  from best
  left join public.profiles p on p.id = best.user_id
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;

grant execute on function public.leaderboard(text, timestamptz, uuid) to anon, authenticated, service_role;
