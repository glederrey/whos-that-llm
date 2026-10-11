-- Model classes. A class has a name, a description, and an optional company.
-- There is no logo column. A later screen uses the company logo when company_id
-- is set, and the site logo when it is not. A model can sit in several classes.
-- The class game mode, its picker, and its per-class leaderboards are not built here.

create table if not exists public.classes (
  id text primary key,
  name text not null unique,
  description text not null default '',
  company_id text references public.companies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_classes (
  model_id text not null references public.models (id) on delete cascade,
  class_id text not null references public.classes (id) on delete cascade,
  primary key (model_id, class_id)
);

create index if not exists model_classes_class_idx on public.model_classes (class_id);

alter table public.classes enable row level security;
alter table public.model_classes enable row level security;

revoke all on table public.classes from public, anon, authenticated;
revoke all on table public.model_classes from public, anon, authenticated;

grant select, insert, update, delete on public.classes to service_role;
grant select, insert, update, delete on public.model_classes to service_role;

drop policy if exists classes_no_client on public.classes;
create policy classes_no_client on public.classes
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists model_classes_no_client on public.model_classes;
create policy model_classes_no_client on public.model_classes
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Family is no longer a hint. Company, region, year, and size still are,
-- and only on a round whose category allows hints.
create or replace function public.apply_hint(
  p_game_id uuid,
  p_user_id uuid,
  p_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.status <> 'active'
     or g.no_hint
     or coalesce((g.rules ->> 'hintsAllowed')::boolean, false) = false
     or p_key not in ('company', 'region', 'year', 'size')
     or p_key = any (g.hints)
     or p_key = any (select jsonb_array_elements_text(g.traits -> 'given'))
  then
    return jsonb_build_object('ok', false, 'error', 'hint');
  end if;
  update public.games set hints = g.hints || array[p_key] where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.apply_hint(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_hint(uuid, uuid, text) to service_role;

-- The newest-in-family flag does not drive a mode. Classes replace it.
alter table public.models drop column if exists is_latest;

-- Hints are possible only on Daily, All models, and Custom.
update public.categories
set hints_allowed = (id in ('daily', 'all', 'custom'));
