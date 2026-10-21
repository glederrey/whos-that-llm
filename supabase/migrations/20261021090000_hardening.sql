-- Defense in depth. RLS already blocks anon and authenticated on these
-- tables, and the app reads them only through the server (service_role) or
-- through security definer functions. Removing the table privileges as well
-- means a mistaken policy later cannot expose them. Idempotent.
revoke all on table public.openrouter_providers from public, anon, authenticated;
revoke all on table public.games, public.messages, public.guesses, public.usage, public.app_settings from public, anon, authenticated;

-- A project created with "Automatically expose new tables" on grants anon and
-- authenticated write privileges by default. The app never writes through the
-- Data API, so take them away. Production already has these grants, so this is
-- a no-op there. A fresh database ends up with the same grants as production.
revoke insert, update, delete on all tables in schema public from public, anon, authenticated;
revoke select on table public.profiles from anon;
