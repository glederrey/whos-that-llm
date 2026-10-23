-- Origin mode: guess where a model comes from. "Region" becomes "Origin" everywhere, and origins become rows an admin can extend.
-- Origin ids stay 'us', 'cn', 'eu' so every stored company, guess and frozen trait still matches.

create table public.origins (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{0,30}$'),
  name text not null check (btrim(name) <> '' and char_length(name) <= 40),
  flag text not null check (btrim(flag) <> '' and char_length(flag) <= 40),
  sort_order int not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.origins is
  'Where a lab comes from. companies.origin and guesses.guessed_origin point here. An origin is never deleted. Turned off, it has no button and no model in the Origin mode, and nothing changes in the other modes.';

insert into public.origins (id, name, flag, sort_order) values
  ('us', 'USA', '🇺🇸', 1),
  ('cn', 'China', '🇨🇳', 2),
  ('eu', 'Europe', '🇪🇺', 3);

-- The region columns become origin columns, linked to the table instead of a fixed list.
alter table public.companies drop constraint companies_region_check;
alter table public.guesses drop constraint guesses_guessed_region_check;

alter table public.companies rename column region to origin;
alter table public.guesses rename column guessed_region to guessed_origin;
alter table public.guesses rename column region_correct to origin_correct;

alter table public.companies
  add constraint companies_origin_fkey foreign key (origin) references public.origins (id);
alter table public.guesses
  add constraint guesses_guessed_origin_fkey foreign key (guessed_origin) references public.origins (id);

alter table public.origins enable row level security;

create policy origins_read on public.origins
  for select to anon, authenticated
  using (true);

create policy origins_no_client_insert on public.origins
  as restrictive
  for insert
  to anon, authenticated
  with check (false);

create policy origins_no_client_update on public.origins
  as restrictive
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy origins_no_client_delete on public.origins
  as restrictive
  for delete
  to anon, authenticated
  using (false);

grant select on public.origins to anon, authenticated;
grant select, insert, update on public.origins to service_role;
revoke insert, update, delete, truncate on table public.origins from public, anon, authenticated;
revoke delete, truncate on table public.origins from service_role;

-- Rounds already stored keep working: the hint key, the given list and each frozen model say origin now.
update public.games
set hints = array_replace(hints, 'region', 'origin')
where 'region' = any (hints);

update public.games g
set traits = jsonb_set(
  jsonb_set(
    g.traits,
    '{given}',
    coalesce(
      (
        select jsonb_agg(case when t.v = 'region' then 'origin' else t.v end order by t.o)
        from jsonb_array_elements_text(g.traits -> 'given') with ordinality as t (v, o)
      ),
      '[]'::jsonb
    )
  ),
  '{models}',
  coalesce(
    (
      select jsonb_object_agg(
        e.k,
        case when e.m ? 'region' then (e.m - 'region') || jsonb_build_object('origin', e.m -> 'region') else e.m end
      )
      from jsonb_each(g.traits -> 'models') as e (k, m)
    ),
    '{}'::jsonb
  )
)
where g.traits::text like '%region%';

-- The Region game mode row becomes Origin. The id is replaced, not updated: games.game_mode points at it.
insert into public.game_modes (id, name, blurb, enabled, leaderboard, hints_allowed, sort_order) values
  ('origin', 'Origin', 'Ten messages, one guess: where does this model come from?', true, false, false, 5);

update public.games set game_mode = 'origin' where game_mode = 'region';
delete from public.game_modes where id = 'region';

create unique index games_one_active_origin_idx
  on public.games (user_id)
  where status = 'active' and game_mode = 'origin';

comment on index public.games_one_active_origin_idx is
  'One active Origin round per account. Origin has no difficulty, so the per-difficulty index does not cover it.';

-- Model guess: the parameter and the columns say origin now.
drop function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, int, jsonb, text[]);

create function public.apply_guess(
  p_game_id uuid,
  p_user_id uuid,
  p_model_id text,
  p_origin text,
  p_model_correct boolean,
  p_company_correct boolean,
  p_origin_correct boolean,
  p_finish text,
  p_score int,
  p_breakdown jsonb,
  p_explanation text[]
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
  if g.status <> 'active' or not g.awaiting_guess then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if not (p_model_id = any (g.pool_model_ids)) then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if p_finish = 'miss' and g.message_count < coalesce((g.rules ->> 'messageLimit')::int, 10) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if p_finish = 'continue' and (p_model_correct or g.message_count >= coalesce((g.rules ->> 'messageLimit')::int, 10)) then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;

  insert into public.guesses (
    game_id, turn, guessed_model_id, guessed_origin,
    model_correct, company_correct, origin_correct
  ) values (
    g.id, g.message_count, p_model_id, p_origin,
    p_model_correct, p_company_correct, p_origin_correct
  );

  if p_finish = 'continue' then
    update public.games set awaiting_guess = false where id = g.id;
  else
    update public.games
    set awaiting_guess = false,
        status = p_finish,
        finished_at = now(),
        score = p_score,
        score_breakdown = p_breakdown,
        score_explanation = p_explanation
    where id = g.id;
  end if;
  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'turn');
end;
$$;

revoke all on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, int, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, text, int, jsonb, text[]) to service_role;

-- Hint: the key is origin now.
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
     or p_key not in ('company', 'origin', 'year', 'size')
     or p_key = any (g.hints)
     or p_key = any (select jsonb_array_elements_text(g.traits -> 'given'))
  then
    return jsonb_build_object('ok', false, 'error', 'hint');
  end if;
  update public.games set hints = g.hints || array[p_key] where id = g.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Origin guess: one origin, no model. Ends the round as solved or miss, with no score.
create function public.apply_origin_guess(
  p_game_id uuid,
  p_user_id uuid,
  p_origin text,
  p_correct boolean
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
  if g.game_mode <> 'origin' or g.status <> 'active' or not g.awaiting_guess or g.message_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'turn');
  end if;
  if not exists (select 1 from public.origins where id = p_origin) then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  insert into public.guesses (
    game_id, turn, guessed_model_id, guessed_origin,
    model_correct, company_correct, origin_correct
  ) values (
    g.id, g.message_count, null, p_origin,
    p_correct, false, p_correct
  );

  update public.games
  set awaiting_guess = false,
      status = case when p_correct then 'solved' else 'miss' end,
      finished_at = now(),
      score = null,
      score_breakdown = null,
      score_explanation = null
  where id = g.id;
  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'turn');
end;
$$;

revoke all on function public.apply_origin_guess(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_origin_guess(uuid, uuid, text, boolean) to service_role;
