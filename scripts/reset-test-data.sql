-- Companies stay: models reference them, and deleting companies would break those foreign keys.
delete from public.usage;
delete from public.guesses;
delete from public.messages;
delete from public.games;
delete from public.profiles;
