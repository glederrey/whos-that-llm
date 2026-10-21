-- Defense in depth. RLS already blocks anon and authenticated on these
-- tables, and the app reads them only through the server (service_role) or
-- through security definer functions. Removing the table privileges as well
-- means a mistaken policy later cannot expose them. Idempotent.
revoke all on table public.openrouter_providers from public, anon, authenticated;
revoke all on table public.games, public.messages, public.guesses, public.usage, public.app_settings from public, anon, authenticated;
