-- The "why" behind the training: a personal goal (e.g. "Top 10 at the state XC
-- meet") the app resurfaces on the home screen and via reminder notifications.
-- Reminder scheduling itself is local to the device (expo-notifications); only
-- the user's preference is synced so it follows the account.

alter table public.profiles
  add column if not exists personal_goal text,
  add column if not exists personal_goal_date date,
  -- 'off' | 'daily' | 'every3' | 'weekly'
  add column if not exists goal_reminder text not null default 'off',
  -- Minutes past local midnight, so it survives timezone-agnostic storage.
  add column if not exists goal_reminder_minute smallint not null default 480;

alter table public.profiles
  add constraint profiles_personal_goal_len
    check (personal_goal is null or char_length(personal_goal) <= 140),
  add constraint profiles_goal_reminder_valid
    check (goal_reminder in ('off', 'daily', 'every3', 'weekly')),
  add constraint profiles_goal_reminder_minute_range
    check (goal_reminder_minute between 0 and 1439);
