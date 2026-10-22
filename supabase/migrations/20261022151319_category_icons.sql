-- A category carries an icon: a company logo, an uploaded image, or one emoji.
-- The Category mode opens for play and for the board.

alter table public.categories
  add column icon_kind text,
  add column icon_value text;

update public.categories
set icon_kind = case when company_id is not null then 'company' else 'emoji' end,
    icon_value = coalesce(company_id, '🗂️');

alter table public.categories
  alter column icon_kind set not null,
  alter column icon_value set not null,
  add constraint categories_icon_kind_check check (icon_kind in ('company', 'image', 'emoji')),
  add constraint categories_icon_value_check check (btrim(icon_value) <> '' and char_length(icon_value) <= 200),
  drop column company_id;

comment on column public.categories.icon_value is
  'company: a companies.id. image: a path in the logos bucket. emoji: the emoji. The app checks the company id.';

create unique index games_one_active_per_category_idx
  on public.games (user_id, game_mode, pool_key)
  where status = 'active' and game_mode = 'class' and pool_key is not null;

comment on index public.games_one_active_per_category_idx is
  'One active Category round per account and category. A different category can start.';

update public.game_modes
set enabled = true, leaderboard = true, hints_allowed = true
where id = 'class';

create or replace function public.leaderboard(
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
          when leaderboard.game_mode in ('company', 'class') then
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
         case when leaderboard.game_mode in ('company', 'class') then best.pool_key else null end as company_id,
         case
           when leaderboard.game_mode = 'company' then co.name
           when leaderboard.game_mode = 'class' then ca.name
           else null
         end as company_name,
         case when leaderboard.game_mode = 'company' then co.logo_path else null end as company_logo
  from best
  left join public.profiles p on p.id = best.user_id
  left join public.companies co on co.id = best.pool_key
  left join public.categories ca on ca.id = best.pool_key
  order by best.score desc, best.message_count asc, best.finished_at asc, best.username;
$$;
