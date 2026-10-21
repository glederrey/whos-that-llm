-- Company can buy the year and the size.
-- The lab and its region are already known, so those are not hints.
-- A round already started keeps the rules it copied. This does not rewrite games.

update public.game_modes
set hints_allowed = true
where id = 'company';
