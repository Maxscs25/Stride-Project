-- A recent race / time-trial used to estimate VO2 max (VDOT). Stored as the
-- raw performance rather than the derived number so the estimate can be
-- recomputed if the model changes, and so the app can show what it came from.
alter table public.profiles
  add column if not exists vo2_baseline_meters numeric,
  add column if not exists vo2_baseline_seconds integer,
  add column if not exists vo2_baseline_date date;
