-- Launch audit hardening.

-- The avatars bucket is public, so a picture is served by its URL without any
-- policy. This policy only let anyone list every file in the bucket.
drop policy if exists avatars_read on storage.objects;

-- Security definer functions resolve names in public, then pg_temp last, so a
-- temp object can never shadow a table or function they call.
alter function public.abort_reply(uuid, uuid, text, boolean) set search_path = public, pg_temp;
alter function public.apply_give_up(uuid, uuid, integer, jsonb, text[]) set search_path = public, pg_temp;
alter function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, integer, jsonb, text[]) set search_path = public, pg_temp;
alter function public.apply_hint(uuid, uuid, text) set search_path = public, pg_temp;
alter function public.apply_origin_guess(uuid, uuid, text, boolean) set search_path = public, pg_temp;
alter function public.apply_reply(uuid, uuid, text, text, integer, integer, integer, integer, numeric, text) set search_path = public, pg_temp;
alter function public.claim_model_call(uuid, uuid) set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.leaderboard(text, timestamptz, uuid, smallint, text) set search_path = public, pg_temp;
alter function public.public_stats() set search_path = public, pg_temp;
alter function public.set_username(text) set search_path = public, pg_temp;
alter function public.start_game(uuid, integer, text, text, boolean, text, text[], jsonb, jsonb, smallint) set search_path = public, pg_temp;

-- The statistics and the admin pages read usage by round and by day.
create index if not exists usage_game_id_idx on public.usage (game_id);
create index if not exists usage_created_at_idx on public.usage (created_at);

-- A score is never negative.
alter table public.games
  add constraint games_score_check check (score is null or score >= 0);
