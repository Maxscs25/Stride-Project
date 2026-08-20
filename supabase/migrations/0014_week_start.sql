-- Whether weeks start Sunday (0) or Monday (1). Defaults to Monday to match
-- the behaviour every existing account already sees.
alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1
  check (week_starts_on in (0, 1));
