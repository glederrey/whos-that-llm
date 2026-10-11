-- Class is a lobby card, still coming soon. The picker, the round, and the
-- per-class leaderboards are not built. Hints stay off.

insert into public.categories (id, name, blurb, enabled, leaderboard, hints_allowed, sort_order)
values (
  'class',
  'Class',
  'One class of models. Opus, or GPT vs Claude.',
  false,
  false,
  false,
  3
)
on conflict (id) do nothing;

update public.categories set sort_order = 4 where id = 'company' and sort_order = 3;
