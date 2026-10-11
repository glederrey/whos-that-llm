-- Deleting an account keeps the rounds and drops the player from them.
-- 0014 cascaded profile deletes into games. This replaces that foreign key
-- with on delete set null. The app still clears games.user_id and
-- games.username before the auth user is deleted, so the name is gone even
-- though the foreign key only nulls user_id.
-- usage stays on game_id. usage.user_id is cleared with the person.
-- The leaderboard skips games whose user_id is null, so those rounds do not
-- become one blank row.

alter table public.games alter column user_id drop not null;
alter table public.games alter column username drop not null;

alter table public.games drop constraint if exists games_user_id_fkey;

alter table public.games
  add constraint games_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.usage alter column user_id drop not null;

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
      and g.user_id is not null
      and g.username is not null
      and btrim(g.username) <> ''
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
