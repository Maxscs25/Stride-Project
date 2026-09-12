-- Minutes of cross-training the user counts as one equivalent mile, so
-- charts and totals can show e.g. "12 (15)" — 12 run, 15 including
-- cross-training. 0 turns the equivalent off. Default 10 matches the most
-- common rule of thumb.
alter table public.profiles
  add column if not exists cross_minutes_per_mile numeric not null default 10
  check (cross_minutes_per_mile >= 0);
