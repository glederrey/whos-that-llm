-- Family is no longer a model trait. Classes are the grouping.
-- 0018 is already in this branch and has not been applied, so this file
-- follows it instead of rewriting that migration.

drop function if exists public.apply_guess(uuid, uuid, text, text, boolean, boolean, boolean, boolean, text, integer, jsonb, text[]);

create function public.apply_guess(
  p_game_id uuid,
  p_user_id uuid,
  p_model_id text,
  p_region text,
  p_model_correct boolean,
  p_company_correct boolean,
  p_region_correct boolean,
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
    game_id, turn, guessed_model_id, guessed_region,
    model_correct, company_correct, region_correct
  ) values (
    g.id, g.message_count, p_model_id, p_region,
    p_model_correct, p_company_correct, p_region_correct
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

alter table public.guesses drop column if exists family_correct;

update public.games
set hints = array_remove(hints, 'family')
where 'family' = any (hints);

update public.games
set traits = jsonb_set(
  traits,
  '{models}',
  (
    select coalesce(jsonb_object_agg(entry.key, entry.value - 'familyId' - 'familyName'), '{}'::jsonb)
    from jsonb_each(traits -> 'models') as entry
  )
)
where jsonb_typeof(traits -> 'models') = 'object';

update public.games
set traits = jsonb_set(
  traits,
  '{given}',
  coalesce(
    (
      select jsonb_agg(to_jsonb(item))
      from jsonb_array_elements_text(traits -> 'given') as item
      where item <> 'family'
    ),
    '[]'::jsonb
  )
)
where jsonb_typeof(traits -> 'given') = 'array'
  and traits -> 'given' ? 'family';

alter table public.models drop column if exists family_id;

drop table if exists public.families;

delete from public.categories where id = 'family';
