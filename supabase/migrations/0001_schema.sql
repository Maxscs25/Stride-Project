-- Stride — core schema
-- Apply with: supabase db push  (after `supabase link`)

create extension if not exists pg_cron;

-- ============ IDENTITY & GOALS ============

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  dob date,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  activity_level text default 'moderate',
  experience_level text default 'recreational',
  units text not null default 'mi' check (units in ('mi','km')),
  timezone text not null default 'America/New_York',
  is_coach boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in
    ('weekly_mileage','race','sleep','strength_freq','nutrition','recovery')),
  target_value numeric,
  target_unit text,
  race_distance text,
  race_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ TRAINING ============

create table public.shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  brand text not null,
  model text not null,
  nickname text,
  color text,
  photo_url text,
  lifespan_miles int not null default 400,
  starting_miles numeric not null default 0,
  is_default boolean not null default false,
  retired_at date,
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null,
  local_date date not null,
  distance_m numeric not null check (distance_m > 0),
  duration_s int not null check (duration_s > 0),
  workout_type text not null default 'easy' check (workout_type in
    ('easy','recovery','tempo','intervals','long','race','hills','fartlek','other')),
  shoe_id uuid references public.shoes on delete set null,
  avg_hr int,
  elevation_gain_m numeric,
  rpe smallint check (rpe between 1 and 10),
  route_polyline text,
  source text not null default 'manual' check (source in
    ('manual','in_app_gps','healthkit','health_connect','terra','strava')),
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index runs_user_date on public.runs (user_id, local_date desc);

create table public.cross_training (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  activity_type text not null check (activity_type in
    ('cycling','swimming','elliptical','rowing','strength','hiking','yoga','other')),
  duration_min int not null check (duration_min > 0),
  intensity smallint check (intensity between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);
create index xt_user_date on public.cross_training (user_id, local_date desc);

-- ============ JOURNAL & WELLNESS ============

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  run_id uuid references public.runs on delete set null,
  cross_training_id uuid references public.cross_training on delete set null,
  body text,
  energy smallint check (energy between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  stress smallint check (stress between 1 and 5),
  mood smallint check (mood between 1 and 5),
  sleep_hours numeric,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  created_at timestamptz not null default now()
);
create index journal_user_date on public.journal_entries (user_id, local_date desc);

-- Structured symptoms extracted from journal text (by Claude Haiku or the user)
create table public.symptom_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  journal_entry_id uuid not null references public.journal_entries on delete cascade,
  body_part text not null,
  symptom_type text not null,
  severity smallint check (severity between 1 and 5),
  extracted_by text not null default 'ai' check (extracted_by in ('ai','user')),
  created_at timestamptz not null default now()
);
create index symptoms_user on public.symptom_tags (user_id, created_at desc);

-- ============ AI OUTPUT ============

-- Materialized nightly by refresh_training_load()
create table public.training_load_daily (
  user_id uuid not null references public.profiles on delete cascade,
  date date not null,
  run_load numeric not null default 0,
  xt_load numeric not null default 0,
  total_load numeric not null default 0,
  acute_load numeric,
  chronic_load numeric,
  acwr numeric,
  weekly_mileage numeric,
  ramp_pct numeric,
  primary key (user_id, date)
);

create table public.ai_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  date date not null,
  signal_type text not null check (signal_type in
    ('acwr_high','ramp_spike','symptom_cluster','sleep_deficit',
     'shoe_worn','underfueling','consistency_win')),
  severity text not null check (severity in ('info','caution','high')),
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  period_start date not null,
  period_end date not null,
  kind text not null default 'weekly' check (kind in ('weekly','alert','celebration')),
  title text not null,
  body_md text not null,
  recommendations jsonb not null default '[]', -- [{slug, reason}] → exercise_library
  evidence jsonb not null default '{}',
  confidence numeric,
  user_feedback smallint, -- 1 helpful / -1 not
  created_at timestamptz not null default now()
);

-- Curated library: the LLM may only recommend by slug from this table
create table public.exercise_library (
  slug text primary key,
  name text not null,
  category text not null check (category in
    ('stretch','mobility','strength','pt','foam_roll','drill')),
  target_areas text[] not null default '{}',
  instructions_md text not null,
  video_url text,
  evidence_level text
);

-- ============ CHECKLIST ============

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  date date not null,
  item_key text not null,
  label text not null,
  source text not null default 'auto' check (source in ('auto','custom','ai','coach')),
  target_value numeric,
  progress_value numeric,
  auto_tracked boolean not null default false,
  completed_at timestamptz,
  unique (user_id, date, item_key)
);

-- ============ NUTRITION ============

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  effective_date date not null,
  calories int not null,
  protein_g int,
  carbs_g int,
  fat_g int,
  method text not null default 'mifflin_st_jeor',
  notes text
);

-- Shared cache (not user-scoped): barcode/USDA lookups land here
create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  brand text,
  serving_desc text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  source text not null default 'off' check (source in ('off','usda','user')),
  created_at timestamptz not null default now()
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  meal text check (meal in ('breakfast','lunch','dinner','snack')),
  food_item_id uuid references public.food_items on delete set null,
  custom_name text,
  servings numeric not null default 1,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  entry_method text not null default 'search' check (entry_method in
    ('barcode','photo','search','manual','quick_add')),
  created_at timestamptz not null default now()
);
create index food_user_date on public.food_logs (user_id, local_date desc);

create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  ml int not null check (ml > 0),
  created_at timestamptz not null default now()
);

-- ============ FORM ANALYSIS ============

create table public.form_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  video_path text,
  view_angle text check (view_angle in ('side','rear')),
  status text not null default 'uploaded' check (status in
    ('uploaded','processing','complete','failed')),
  keypoints_path text,
  metrics jsonb,   -- {cadence_spm, trunk_lean_deg, overstride_score, ...}
  findings jsonb,  -- [{metric, rating, confidence, note}]
  report_md text,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

-- ============ COACH SYSTEM ============

create table public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles on delete cascade,
  athlete_id uuid not null references public.profiles on delete cascade,
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  -- Single source of truth for what the coach may see (enforced by RLS)
  permissions jsonb not null default
    '{"mileage":true,"workouts":true,"wellness":true,"notes":false,"nutrition":false,"checklist":true}',
  created_at timestamptz not null default now(),
  unique (coach_id, athlete_id)
);

create table public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  ref_type text check (ref_type in ('run','cross_training','week','general')),
  ref_id uuid,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.suggested_workouts (
  id uuid primary key default gen_random_uuid(),
  coach_link_id uuid not null references public.coach_links on delete cascade,
  date date not null,
  workout_type text,
  description_md text not null,
  accepted_at timestamptz,
  completed_run_id uuid references public.runs on delete set null,
  created_at timestamptz not null default now()
);

-- ============ RECORDS, BILLING, JOBS ============

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  distance_key text not null,
  duration_s int not null,
  run_id uuid references public.runs on delete set null,
  achieved_on date not null,
  unique (user_id, distance_key)
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles on delete cascade,
  revenuecat_id text,
  entitlement text not null default 'free' check (entitlement in ('free','premium','coach_pro')),
  status text,
  renews_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
