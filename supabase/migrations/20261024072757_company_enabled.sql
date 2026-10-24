-- A company can be turned off. Off, it has no card in the Company game. Its models stay in every other mode.

alter table public.companies
  add column enabled boolean not null default true;

comment on column public.companies.enabled is
  'False hides the company from the Company game picker and refuses a new Company round for it. A round already started stays playable. Models, the other modes and the leaderboards do not change.';
