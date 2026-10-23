-- Custom mode: the player picks the models of the pool (at least 2). Hints can be bought, there is no leaderboard and no difficulty.

update public.game_modes
set enabled = true,
    leaderboard = false,
    hints_allowed = true,
    blurb = 'Pick your own models, at least two, and guess which one is hiding.'
where id = 'custom';

-- Custom has no difficulty and no pool key, so the per-difficulty index does not cover it.
create unique index games_one_active_custom_idx
  on public.games (user_id)
  where status = 'active' and game_mode = 'custom';

comment on index public.games_one_active_custom_idx is
  'One active Custom round per account. The pool is the player''s own choice, so a second round would start from a different list of models.';
