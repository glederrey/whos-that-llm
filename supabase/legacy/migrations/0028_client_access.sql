-- Visitors and signed-in players cannot empty tables, call the signup trigger,
-- or write profiles and avatars except through the server.
-- The public model list stays the enabled id, name, company, and logo.

revoke truncate, trigger, references on all tables in schema public from public, anon, authenticated;

alter default privileges in schema public revoke truncate, trigger, references on tables from public, anon, authenticated;

revoke insert, update, delete on table public.profiles from public, anon, authenticated;

drop policy if exists profiles_update_username on public.profiles;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

drop policy if exists models_no_client_write on public.models;
drop policy if exists models_no_client_insert on public.models;
drop policy if exists models_no_client_update on public.models;
drop policy if exists models_no_client_delete on public.models;

create policy models_no_client_insert on public.models
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

create policy models_no_client_update on public.models
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy models_no_client_delete on public.models
  as restrictive
  for delete
  to anon, authenticated
  using (false);

drop policy if exists models_read_enabled on public.models;
create policy models_read_enabled on public.models
  for select
  to anon, authenticated
  using (enabled);

revoke all on table public.models from public, anon, authenticated;
grant select (id, name, company_id, logo_path, enabled) on public.models to anon, authenticated;

alter view public.models_public set (security_invoker = true);

drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;
