-- A model OpenRouter no longer lists stays in the table.
-- available = false keeps it off new rounds and refuses turning it on.
-- Past games keep their model_id. This does not delete games or models.

alter table public.models
  add column if not exists available boolean not null default true;

alter table public.models
  drop constraint if exists models_unavailable_stays_off;

alter table public.models
  add constraint models_unavailable_stays_off check (available or not enabled);

comment on column public.models.available is
  'False when OpenRouter no longer lists the model. The row stays so a past game can still name it. It cannot be turned on.';
