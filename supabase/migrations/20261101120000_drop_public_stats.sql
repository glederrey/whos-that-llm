-- The home page no longer shows counts, so nothing calls public_stats().
drop function if exists public.public_stats();
