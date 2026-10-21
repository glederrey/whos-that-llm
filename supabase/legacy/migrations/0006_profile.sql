-- Profile: an avatar path, and a rename that rewrites every game for that user id.
-- The leaderboard reads games.username, so the old name is not kept.

alter table public.profiles add column if not exists avatar_path text;

create or replace function public.set_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(coalesce(p_username, ''));
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if char_length(cleaned) < 3 or char_length(cleaned) > 20 or cleaned ~ '[\n\r]' then
    return jsonb_build_object('ok', false, 'error', 'username');
  end if;
  update public.profiles set username = cleaned where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  update public.games set username = cleaned where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_username(text) from public, anon, authenticated;
grant execute on function public.set_username(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
