-- Onboarding fields + athlete-initiated coach invites.

alter table public.profiles
  add column if not exists age smallint,
  add column if not exists weekly_goal_mi numeric,
  add column if not exists race_goal text,
  add column if not exists onboarded_at timestamptz;

-- One coach per athlete pair, so redeeming twice re-activates instead of duplicating
alter table public.coach_links
  add constraint coach_links_pair unique (coach_id, athlete_id);

-- Athlete-generated invite codes (the design's "user invites their coach" flow)
create table public.coach_invites (
  code text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  athlete_id uuid not null references public.profiles on delete cascade,
  permissions jsonb not null default
    '{"mileage":true,"workouts":true,"wellness":true,"notes":false,"nutrition":false,"checklist":true}',
  created_at timestamptz not null default now(),
  claimed_by uuid references public.profiles,
  claimed_at timestamptz
);
alter table public.coach_invites enable row level security;
create policy coach_invites_athlete on public.coach_invites
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- Coach redeems a code → active link with the athlete-chosen permissions
create or replace function public.redeem_coach_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from coach_invites
   where code = lower(trim(p_code)) and claimed_by is null
     and created_at > now() - interval '14 days';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired code');
  end if;
  if v.athlete_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'You cannot be your own coach');
  end if;
  insert into coach_links (coach_id, athlete_id, status, permissions)
  values (auth.uid(), v.athlete_id, 'active', v.permissions)
  on conflict (coach_id, athlete_id)
    do update set status = 'active', permissions = excluded.permissions;
  update coach_invites set claimed_by = auth.uid(), claimed_at = now()
   where code = v.code;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.redeem_coach_invite(text) to authenticated;

-- Linked coaches/athletes may read each other's display profile
create policy profiles_linked_read on public.profiles
  for select using (
    exists (
      select 1 from coach_links cl
      where cl.status = 'active'
        and ((cl.coach_id = profiles.id and cl.athlete_id = auth.uid())
          or (cl.athlete_id = profiles.id and cl.coach_id = auth.uid()))
    )
  );
