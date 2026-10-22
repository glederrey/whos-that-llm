-- A category can be turned off, like a model. It keeps its rows, links and games.
-- A category with no image, emoji or company gets the Who's that LLM logo ('default').

alter table public.categories
  add column enabled boolean not null default true;

alter table public.categories
  drop constraint categories_icon_kind_check,
  drop constraint categories_icon_value_check,
  add constraint categories_icon_kind_check check (icon_kind in ('company', 'image', 'emoji', 'default')),
  add constraint categories_icon_value_check check (
    char_length(icon_value) <= 200 and (icon_kind = 'default' or btrim(icon_value) <> '')
  );

comment on column public.categories.icon_value is
  'company: a companies.id. image: a path in the logos bucket. emoji: the emoji. default: empty. The app checks the company id.';
