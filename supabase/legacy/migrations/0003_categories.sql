-- Lineup: Daily, All models, Company, Family, Region, Custom.
-- Latest was the same draw as All models. Origin was the same pool as Region.
-- Safe to run again. Rows with a finished or active game are left in place.

insert into public.categories (id, name, blurb, enabled, leaderboard, hints_allowed, sort_order)
values ('custom', 'Custom', 'A custom choice of models.', false, false, false, 6)
on conflict (id) do update set
  name = excluded.name,
  blurb = excluded.blurb,
  sort_order = excluded.sort_order;

update public.categories set sort_order = 1 where id = 'daily';
update public.categories set sort_order = 2 where id = 'all';
update public.categories set sort_order = 3 where id = 'company';
update public.categories set sort_order = 4 where id = 'family';
update public.categories set sort_order = 5 where id = 'region';

delete from public.categories
where id in ('latest', 'origin')
  and not exists (
    select 1 from public.games where games.category = categories.id
  );
