-- Deleting an account removes that player's rounds.
-- 0013 dropped games_user_id_fkey so a round could outlive the profile.
-- This puts the foreign key back. Deleting the profile deletes its games.
-- messages, guesses, and usage rows that point at a game already cascade from games.

alter table public.games drop constraint if exists games_user_id_fkey;

alter table public.games
  add constraint games_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
