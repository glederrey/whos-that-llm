-- Keep finished rounds when a player deletes their sign-in.
-- games.user_id stays as the historical id. games.username stays for the leaderboard.
-- Dropping the foreign key lets profiles cascade from auth.users without deleting games.

alter table public.games drop constraint if exists games_user_id_fkey;
