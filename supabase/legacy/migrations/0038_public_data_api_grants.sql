-- From 30 Oct 2026, new tables and sequences in public are not granted to
-- anon, authenticated, or service_role. Tables that already exist keep
-- their current grants. This repeats those grants so a reset, a preview
-- branch, or a new project can still reach them through the Data API.
-- Defaults are set first so a later migration's tables are covered too.
-- Default privileges do not apply to tables created earlier in a reset,
-- so the current tables are granted again below. Re-granting is idempotent.
-- anon can select the public roster only. authenticated can select that
-- roster and profiles. Neither role is granted writes. service_role keeps
-- select, insert, update, and delete on the tables it already writes.
-- Row level security still applies.
-- Sequences lose usage and select as well, so those are granted again.
-- Function execute is unchanged: each function already names its roles,
-- and a grant on all functions would let anon call the service-only ones.

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

grant select on public.companies, public.game_modes to anon, authenticated;
grant select (id, name, company_id, logo_path, enabled) on public.models to anon, authenticated;
grant select on public.models_public to anon, authenticated, service_role;
grant select on public.profiles to authenticated;

grant select, insert, update, delete on
  public.companies,
  public.models,
  public.game_modes,
  public.app_settings,
  public.profiles,
  public.games,
  public.messages,
  public.guesses,
  public.usage,
  public.categories,
  public.model_categories,
  public.daily_models,
  public.openrouter_providers
to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
