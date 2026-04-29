create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists wishlists_user_product_unique
  on public.wishlists (user_id, product_id);

create index if not exists wishlists_user_idx on public.wishlists (user_id);

alter table public.wishlists enable row level security;

create policy "Users manage own wishlist"
  on public.wishlists
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
