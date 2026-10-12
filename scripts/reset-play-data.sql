-- Destructive. Run this by hand in the Supabase SQL editor. It is not a migration.
--
-- Deletes play history only: messages, guesses, usage, and games.
-- Hints live on games.hints, and the leaderboard is public.leaderboard() over games,
-- so both disappear with those rows. There is no hints table and no leaderboard table.
--
-- Keeps auth.users, profiles (usernames and avatars), models, companies, families,
-- categories, app_settings, and storage objects (logos and avatars).
-- Does not drop tables, policies, or functions, and does not change the schema.
--
-- messages.game_id, guesses.game_id, and usage.game_id reference games on delete cascade.
-- games.user_id references profiles (games_user_id_fkey). Truncating only these four
-- tables leaves profiles and the roster in place. Safe to run again when they are empty.
--
-- Refuses unless this session has set app.confirm_data_reset to yes.

do $$
begin
  if current_setting('app.confirm_data_reset', true) is distinct from 'yes' then
    raise exception 'data reset refused';
  end if;

  truncate table
    public.messages,
    public.guesses,
    public.usage,
    public.games;
end $$;
