-- OpenRouter providers we have already judged.
-- A missing slug has not been seen. blacklisted true is passed as provider.ignore.
-- The reason is the log for a blacklist: date, model, provider, messages, and token counts.
-- Clearing the flag keeps that log so a false trigger can still be read.

create table if not exists public.openrouter_providers (
  slug text primary key,
  blacklisted boolean not null default false,
  reason text,
  model text,
  input_text text,
  output_text text,
  input_tokens int,
  output_tokens int,
  reasoning_tokens int,
  cached_tokens int,
  gpt_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.openrouter_providers enable row level security;

grant select, insert, update, delete on public.openrouter_providers to service_role;
