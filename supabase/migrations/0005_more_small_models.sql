-- More small models, so a wrong guess can stay in the same company.
-- Same rows as the seed in 0001. Safe to run on a database that already has them.
-- OpenRouter lists no other small Anthropic model besides Haiku 4.5 and Haiku 5.5.

insert into public.models (
  id, openrouter_id, name, company_id, family_id, size, open_weights, reasoning,
  provider_settings, is_latest, released_on, enabled, input_usd_per_mtok, output_usd_per_mtok
) values
  ('claude-haiku-4-5', 'anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'anthropic', 'haiku', 'small', false, true, '{"reasoning":{"effort":"low"}}', false, '2025-10-15', true, 1, 5),
  ('gpt-5-6-luna-pro', 'openai/gpt-5.6-luna-pro', 'GPT-5.6 Luna Pro', 'openai', 'gpt', 'small', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-07-09', true, 0.2, 1.2),
  ('gpt-6-luna', 'openai/gpt-6-luna', 'GPT-6 Luna', 'openai', 'gpt', 'small', false, true, '{"reasoning":{"effort":"low"}}', false, '2026-09-22', true, 0.1, 0.5)
on conflict (id) do nothing;

-- A second Haiku exists, so the family is no longer a one-model pool.
update public.families set enabled = true where id = 'haiku';
