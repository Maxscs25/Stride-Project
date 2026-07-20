-- Strava integration: per-user OAuth tokens + short-lived OAuth state.
-- Tokens are written/read by edge functions (service role); the app can only
-- see whether a connection exists and remove it.

create table public.strava_connections (
  user_id uuid primary key references public.profiles on delete cascade,
  athlete_id bigint unique not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
create policy strava_conn_select on public.strava_connections
  for select using (user_id = auth.uid());
create policy strava_conn_delete on public.strava_connections
  for delete using (user_id = auth.uid());

-- OAuth state handshake rows; service-role only (no client policies)
create table public.oauth_states (
  state uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  provider text not null default 'strava',
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
