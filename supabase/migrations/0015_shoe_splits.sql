-- Allow one run's mileage to be divided between shoes, e.g. a shakeout in the
-- daily trainer and the workout in racers.
--
-- Stored as jsonb on the run rather than a run_shoes join table: it keeps a run
-- a single row, which means the client's offline write-queue (keyed by row id)
-- needs no special handling for one-run-to-many-rows. shoe_id stays the
-- representation for ordinary single-shoe runs, so existing rows are untouched.
alter table public.runs
  add column if not exists shoe_splits jsonb;

-- Logged miles for one shoe, honouring splits when present.
create or replace function public.shoe_logged_miles(p_shoe uuid, p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(sum(
    case
      when r.shoe_splits is null then
        case when r.shoe_id = p_shoe then r.distance_m / 1609.34 else 0 end
      else
        coalesce((
          select sum((e ->> 'miles')::numeric)
          from jsonb_array_elements(r.shoe_splits) e
          where (e ->> 'shoeId') = p_shoe::text
        ), 0)
    end
  ), 0)
  from public.runs r
  where r.user_id = p_user;
$fn$;

-- detect_signals' worn-shoe check joined runs.shoe_id, so a split run was
-- attributed entirely to one shoe (or missed). That would make the AI's
-- replacement warnings disagree with the mileage shown in the app. Recreated
-- here with the shoe loop routed through shoe_logged_miles(); every other
-- branch is unchanged.
create or replace function public.detect_signals(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_acwr numeric;
  v_this_week numeric;
  v_last_week numeric;
  v_sleep_avg numeric;
  rec record;
begin
  delete from ai_signals where user_id = p_user and date = current_date;

  select acwr into v_acwr from training_load_daily
   where user_id = p_user and date = current_date;

  select coalesce(sum(distance_m), 0) / 1609.34 into v_this_week from runs
   where user_id = p_user
     and local_date >= date_trunc('week', current_date)::date;
  select coalesce(sum(distance_m), 0) / 1609.34 into v_last_week from runs
   where user_id = p_user
     and local_date >= date_trunc('week', current_date)::date - 7
     and local_date < date_trunc('week', current_date)::date;

  if v_acwr is not null and v_acwr > 1.3 then
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'acwr_high',
      case when v_acwr > 1.5 then 'high' else 'caution' end,
      jsonb_build_object('acwr', v_acwr));
  end if;

  if v_last_week >= 10 and v_this_week > v_last_week * 1.25 then
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'ramp_spike',
      case when v_this_week > v_last_week * 1.35 then 'high' else 'caution' end,
      jsonb_build_object('this_week_mi', round(v_this_week, 1),
                         'last_week_mi', round(v_last_week, 1)));
  end if;

  -- Symptom clusters: same body part tagged 3+ times in 14 days
  for rec in
    select body_part, count(*) n from symptom_tags
    where user_id = p_user and created_at > now() - interval '14 days'
    group by body_part having count(*) >= 3
  loop
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'symptom_cluster', 'caution',
      jsonb_build_object('body_part', rec.body_part, 'mentions_14d', rec.n));
  end loop;

  select avg(sleep_hours) into v_sleep_avg from journal_entries
   where user_id = p_user and local_date > current_date - 7
     and sleep_hours is not null;
  if v_sleep_avg is not null and v_sleep_avg < 6.75 then
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'sleep_deficit', 'caution',
      jsonb_build_object('avg_sleep_7d', round(v_sleep_avg, 1)));
  end if;

  -- Worn shoes (mileage honours per-shoe splits)
  for rec in
    select s.id, s.model, s.lifespan_miles,
           s.starting_miles + public.shoe_logged_miles(s.id, p_user) as miles
    from shoes s
    where s.user_id = p_user and s.retired_at is null
      and s.starting_miles + public.shoe_logged_miles(s.id, p_user)
          >= s.lifespan_miles * 0.9
  loop
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'shoe_worn', 'info',
      jsonb_build_object('model', rec.model, 'miles', round(rec.miles),
                         'lifespan', rec.lifespan_miles));
  end loop;

  -- Consistency win: 4+ runs in each of the last 3 completed weeks
  if (select count(*) = 3 from (
        select date_trunc('week', local_date) w, count(*) n from runs
        where user_id = p_user
          and local_date >= date_trunc('week', current_date)::date - 21
          and local_date < date_trunc('week', current_date)::date
        group by 1 having count(*) >= 4) x) then
    insert into ai_signals (user_id, date, signal_type, severity, evidence)
    values (p_user, current_date, 'consistency_win', 'info', '{}');
  end if;
end $$;
