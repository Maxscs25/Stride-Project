-- Terra integration (Garmin, COROS, Polar, Suunto, ... direct sync).
-- Terra holds the provider tokens; we store only the Terra user id linkage.

create table public.terra_connections (
  user_id uuid primary key references public.profiles on delete cascade,
  terra_user_id text unique not null,
  provider text,
  connected_at timestamptz not null default now()
);

alter table public.terra_connections enable row level security;
create policy terra_conn_select on public.terra_connections
  for select using (user_id = auth.uid());
-- Deletion goes through the terra edge function (it must also deauth with
-- Terra's API), so no client delete policy.
