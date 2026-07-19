-- Stride — row-level security
-- Owner-only by default; coach read access is gated by coach_links.permissions,
-- so revoking a scope (or the link) cuts access at the database, not the UI.

-- Helper: does an active coach link grant `scope` on this athlete's data?
create or replace function public.coach_can_view(athlete uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from coach_links cl
    where cl.athlete_id = athlete
      and cl.coach_id = auth.uid()
      and cl.status = 'active'
      and coalesce((cl.permissions ->> scope)::boolean, false)
  );
$$;

-- ---------- owner-only tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'goals','shoes','symptom_tags','ai_signals','ai_insights','training_load_daily',
    'nutrition_targets','food_logs','hydration_logs','form_analyses',
    'personal_records','subscriptions','jobs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- ---------- profiles ----------
alter table public.profiles enable row level security;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_coach_read on public.profiles
  for select using (public.coach_can_view(id, 'mileage'));

-- ---------- athlete data with scoped coach read ----------
alter table public.runs enable row level security;
create policy runs_owner on public.runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy runs_coach_read on public.runs
  for select using (public.coach_can_view(user_id, 'workouts'));

alter table public.cross_training enable row level security;
create policy xt_owner on public.cross_training
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy xt_coach_read on public.cross_training
  for select using (public.coach_can_view(user_id, 'workouts'));

alter table public.journal_entries enable row level security;
create policy journal_owner on public.journal_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Wellness sliders vs. free-text notes are separate scopes; the API layer
-- must null out `body` unless the 'notes' scope is granted.
create policy journal_coach_read on public.journal_entries
  for select using (public.coach_can_view(user_id, 'wellness'));

alter table public.checklist_items enable row level security;
create policy checklist_owner on public.checklist_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checklist_coach_read on public.checklist_items
  for select using (public.coach_can_view(user_id, 'checklist'));

-- ---------- shared read-only reference tables ----------
alter table public.exercise_library enable row level security;
create policy exercise_read on public.exercise_library for select using (true);

alter table public.food_items enable row level security;
create policy food_items_read on public.food_items for select using (true);
create policy food_items_insert on public.food_items
  for insert with check (auth.uid() is not null);

-- ---------- coach relationship tables ----------
alter table public.coach_links enable row level security;
create policy coach_links_parties on public.coach_links
  for select using (coach_id = auth.uid() or athlete_id = auth.uid());
create policy coach_links_athlete_manage on public.coach_links
  for update using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy coach_links_coach_invite on public.coach_links
  for insert with check (coach_id = auth.uid());

alter table public.coach_comments enable row level security;
create policy coach_comments_parties on public.coach_comments
  for select using (exists (
    select 1 from coach_links cl where cl.id = coach_link_id
      and (cl.coach_id = auth.uid() or cl.athlete_id = auth.uid())
      and cl.status = 'active'));
create policy coach_comments_write on public.coach_comments
  for insert with check (author_id = auth.uid() and exists (
    select 1 from coach_links cl where cl.id = coach_link_id
      and (cl.coach_id = auth.uid() or cl.athlete_id = auth.uid())
      and cl.status = 'active'));

alter table public.suggested_workouts enable row level security;
create policy suggested_parties on public.suggested_workouts
  for select using (exists (
    select 1 from coach_links cl where cl.id = coach_link_id
      and (cl.coach_id = auth.uid() or cl.athlete_id = auth.uid())
      and cl.status = 'active'));
create policy suggested_coach_write on public.suggested_workouts
  for insert with check (exists (
    select 1 from coach_links cl where cl.id = coach_link_id
      and cl.coach_id = auth.uid() and cl.status = 'active'));
create policy suggested_athlete_update on public.suggested_workouts
  for update using (exists (
    select 1 from coach_links cl where cl.id = coach_link_id
      and cl.athlete_id = auth.uid() and cl.status = 'active'));
