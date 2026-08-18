-- Recurring weekly training template: what each weekday is normally for
-- (long run, quality session, easy, rest) and its target mileage. Stored as
-- one small array on the profile rather than its own table — it's exactly
-- seven rows, always read and written together, and never queried across.
alter table public.profiles
  add column if not exists week_plan jsonb;
