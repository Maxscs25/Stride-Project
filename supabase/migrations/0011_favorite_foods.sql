-- Saved foods for one-tap re-logging of common items.
create table public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null,
  brand text,
  serving_desc text,
  barcode text,
  calories numeric not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);
create index favorite_foods_user on public.favorite_foods (user_id, created_at desc);

alter table public.favorite_foods
  add constraint favorite_foods_name_len check (char_length(name) <= 120),
  add constraint favorite_foods_brand_len check (brand is null or char_length(brand) <= 80),
  add constraint favorite_foods_serving_desc_len check (serving_desc is null or char_length(serving_desc) <= 60);

alter table public.favorite_foods enable row level security;
create policy favorite_foods_owner on public.favorite_foods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
