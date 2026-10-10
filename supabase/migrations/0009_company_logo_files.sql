-- The files in the public logos bucket. These are the logos the game shows.

update public.companies set logo_path = 'logos/anthropic.png' where id = 'anthropic';
update public.companies set logo_path = 'logos/openai.png' where id = 'openai';
update public.companies set logo_path = 'logos/deepseek.png' where id = 'deepseek';
update public.companies set logo_path = 'logos/mistral.png' where id = 'mistral';
