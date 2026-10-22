-- Prices are read live from OpenRouter on the admin models page, so the roster no longer stores them.
alter table public.models
  drop column input_usd_per_mtok,
  drop column output_usd_per_mtok;
