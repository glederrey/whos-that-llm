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
     or p_key not in ('company', 'family', 'region', 'year', 'size')
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
