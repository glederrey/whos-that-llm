-- Removes play rows and profiles. Companies stay: models reference them.
-- Refuses unless this session has set app.confirm_data_reset to yes.

do $$
begin
  if current_setting('app.confirm_data_reset', true) is distinct from 'yes' then
    raise exception 'data reset refused';
  end if;

  delete from public.usage;
  delete from public.guesses;
  delete from public.messages;
  delete from public.games;
  delete from public.profiles;
end $$;
