-- Security hardening (OWASP-aligned): input length limits at the database
-- (defense in depth — the client validates too, but the DB is the last line),
-- plus a rate-limit primitive for the cost-bearing AI endpoint.

-- ---------- Length limits on user-writable text ----------
-- Postgres `text` is unbounded; without caps a single row could store megabytes
-- (storage abuse / UI DoS). These bounds are generous but finite.
alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) <= 60),
  add constraint profiles_race_goal_len check (race_goal is null or char_length(race_goal) <= 120);

alter table public.shoes
  add constraint shoes_brand_len check (char_length(brand) <= 60),
  add constraint shoes_model_len check (char_length(model) <= 80),
  add constraint shoes_nickname_len check (nickname is null or char_length(nickname) <= 60);

alter table public.journal_entries
  add constraint journal_body_len check (body is null or char_length(body) <= 4000);

alter table public.cross_training
  add constraint xt_notes_len check (notes is null or char_length(notes) <= 2000);

alter table public.food_logs
  add constraint food_custom_name_len check (custom_name is null or char_length(custom_name) <= 120);

alter table public.coach_comments
  add constraint coach_comment_len check (char_length(body) between 1 and 2000);

-- ---------- Rate limiting ----------
-- Fixed-window counter keyed by (user, action). Cheap, works across the
-- stateless edge-function invocations that in-memory limiting can't.
create table if not exists public.rate_limits (
  user_id uuid not null references public.profiles on delete cascade,
  action text not null,
  window_start timestamptz not null default now(),
  count int not null default 0,
  primary key (user_id, action)
);
alter table public.rate_limits enable row level security;
-- No client policies: only edge functions (service role) touch this table.

-- Returns true if the call is allowed, false if the limit is exceeded.
-- Resets the window once `p_window_seconds` have elapsed.
create or replace function public.check_rate_limit(
  p_user uuid,
  p_action text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row rate_limits%rowtype;
begin
  select * into v_row from rate_limits
    where user_id = p_user and action = p_action for update;

  if not found then
    insert into rate_limits (user_id, action, window_start, count)
      values (p_user, p_action, now(), 1);
    return true;
  end if;

  if v_row.window_start < now() - make_interval(secs => p_window_seconds) then
    update rate_limits set window_start = now(), count = 1
      where user_id = p_user and action = p_action;
    return true;
  end if;

  if v_row.count >= p_max then
    return false;
  end if;

  update rate_limits set count = count + 1
    where user_id = p_user and action = p_action;
  return true;
end $$;

revoke all on function public.check_rate_limit(uuid, text, int, int) from public, anon, authenticated;

-- ---------- Harden coach-invite redemption against code guessing ----------
-- Codes are short; cap redemption attempts per coach to make enumeration
-- impractical. Re-declares the function from 0007 with a rate-limit gate and
-- input normalisation.
create or replace function public.redeem_coach_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_code text := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
begin
  if char_length(v_code) not between 4 and 16 then
    return jsonb_build_object('ok', false, 'error', 'Invalid code');
  end if;
  -- 20 attempts/hour/coach — plenty for real use, useless for brute force
  if not public.check_rate_limit(auth.uid(), 'redeem_invite', 20, 3600) then
    return jsonb_build_object('ok', false, 'error', 'Too many attempts — try again later');
  end if;

  select * into v from coach_invites
   where code = v_code and claimed_by is null
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
