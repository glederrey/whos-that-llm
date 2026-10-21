-- Each round is games.id. This table keeps what the player sent and what the model answered.
-- Safe to run after 0001_init.sql. The create is a no-op when the table is already there.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn int not null check (turn between 1 and 10),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (game_id, turn, role)
);

comment on table public.messages is
  'Transcript of one round. role user is the player, role assistant is the model. Kept for later analysis. The score does not read these rows.';

comment on column public.messages.game_id is
  'The round. games.id is the session id.';

comment on column public.messages.turn is
  '1 to 10. The player row and the model row of one exchange share this number.';

comment on column public.messages.role is
  'user or assistant.';

comment on column public.messages.content is
  'The player text, or the model reply. An empty reply is still stored.';

alter table public.messages enable row level security;

grant select, insert, update, delete on public.messages to service_role;
