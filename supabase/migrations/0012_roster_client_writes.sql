-- Client roles can read companies, families, and the public model view.
-- They cannot insert, update, or delete the roster. The server key does that
-- after the owner check. Stats for that page are not a public function.

revoke all on table public.models from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.companies from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.families from public, anon, authenticated;

grant select on table public.companies to anon, authenticated;
grant select on table public.families to anon, authenticated;
grant select on table public.models_public to anon, authenticated;

alter table public.models enable row level security;
alter table public.companies enable row level security;
alter table public.families enable row level security;

drop policy if exists models_no_client_write on public.models;
create policy models_no_client_write on public.models
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists companies_no_client_insert on public.companies;
create policy companies_no_client_insert on public.companies
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists companies_no_client_update on public.companies;
create policy companies_no_client_update on public.companies
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists companies_no_client_delete on public.companies;
create policy companies_no_client_delete on public.companies
  as restrictive
  for delete
  to anon, authenticated
  using (false);

drop policy if exists families_no_client_insert on public.families;
create policy families_no_client_insert on public.families
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists families_no_client_update on public.families;
create policy families_no_client_update on public.families
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists families_no_client_delete on public.families;
create policy families_no_client_delete on public.families
  as restrictive
  for delete
  to anon, authenticated
  using (false);
