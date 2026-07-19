-- Stride — deterministic training-load signal engine (Layer 1 + Layer 2).
-- The LLM (weekly-insight edge function) narrates these outputs; it never
-- computes load math itself. Mirrored client-side in src/lib/load.ts.

-- Session RPE load, with type defaults when the runner didn't rate effort
create or replace function public.srpe_load(duration_s int, rpe smallint, workout_type text)
returns numeric language sql immutable as $$
  select (duration_s / 60.0) * coalesce(rpe, case workout_type
    when 'easy' then 3 when 'recovery' then 2 when 'long' then 5
    when 'tempo' then 7 when 'intervals' then 8 when 'race' then 9
    when 'hills' then 6 else 4 end);
$$;

-- Layer 1: rebuild training_load_daily for one user over a window,
-- including 7d/28d EWMA (acute/chronic) and ACWR.
create or replace function public.refresh_training_load(p_user uuid, p_days int default 120)
returns void language plpgsql security definer set search_path = public as $$
declare
  d date;
  v_load numeric;
  v_acute numeric := 0;
  v_chronic numeric := 0;
  la constant numeric := 2.0 / 8.0;
  lc constant numeric := 2.0 / 29.0;
begin
  for d in select generate_series(current_date - p_days, current_date, '1 day')::date loop
    select coalesce((
        select sum(srpe_load(r.duration_s, r.rpe, r.workout_type))
        from runs r where r.user_id = p_user and r.local_date = d), 0)
      + coalesce((
        select sum(x.duration_min * coalesce(x.intensity, 3) * 0.6)
        from cross_training x where x.user_id = p_user and x.local_date = d), 0)
    into v_load;

    v_acute := la * v_load + (1 - la) * v_acute;
    v_chronic := lc * v_load + (1 - lc) * v_chronic;

    insert into training_load_daily as t
      (user_id, date, run_load, xt_load, total_load, acute_load, chronic_load, acwr,
       weekly_mileage, ramp_pct)
    values (p_user, d, 0, 0, v_load, v_acute, v_chronic,
      case when v_chronic > 5 then round(v_acute / v_chronic, 3) else null end,
      (select coalesce(sum(distance_m), 0) / 1609.34 from runs
        where user_id = p_user
          and local_date between date_trunc('week', d)::date and d),
      null)
    on conflict (user_id, date) do update set
      total_load = excluded.total_load,
      acute_load = excluded.acute_load,
      chronic_load = excluded.chronic_load,
      acwr = excluded.acwr,
      weekly_mileage = excluded.weekly_mileage;
  end loop;
end $$;

-- Layer 2: evaluate rules and emit typed signals with evidence JSON
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

  -- Worn shoes
  for rec in
    select s.id, s.model, s.lifespan_miles,
           s.starting_miles + coalesce(sum(r.distance_m), 0) / 1609.34 as miles
    from shoes s left join runs r on r.shoe_id = s.id
    where s.user_id = p_user and s.retired_at is null
    group by s.id
    having s.starting_miles + coalesce(sum(r.distance_m), 0) / 1609.34
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

-- Nightly refresh for all active users (2:10 AM UTC)
select cron.schedule('stride-nightly-load', '10 2 * * *', $$
  select public.refresh_training_load(id), public.detect_signals(id)
  from public.profiles
$$);
