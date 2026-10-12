-- Model sets take the name category, now that the game mode no longer uses it.
-- classes becomes categories, model_classes becomes model_categories, and
-- class_id becomes category_id. Existing rows stay. The game mode that plays
-- one of these sets keeps its id, and its player-facing name becomes Category.

alter table public.classes rename to categories;
alter table public.model_classes rename to model_categories;
alter table public.model_categories rename column class_id to category_id;
alter index public.model_classes_class_idx rename to model_categories_category_idx;
alter policy classes_no_client on public.categories rename to categories_no_client;
alter policy model_classes_no_client on public.model_categories rename to model_categories_no_client;

update public.game_modes
set
  name = 'Category',
  blurb = 'A set we define, not a lab''s line. Only Opus, only the nano models, or obscure ones.'
where id = 'class';
