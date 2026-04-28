-- Cupons, Fretes por UF, Banner do site, Reenvios

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric not null default 0,
  min_subtotal numeric not null default 0,
  max_uses integer,
  uses integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
create policy "coupons select active for everyone" on public.coupons
  for select using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "coupons admin all" on public.coupons
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  label text not null default 'Padrão',
  price numeric not null default 0,
  delivery_days_min integer,
  delivery_days_max integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shipping_rates_state_label_unique on public.shipping_rates (state, label);
alter table public.shipping_rates enable row level security;
create policy "shipping_rates select all" on public.shipping_rates
  for select using (true);
create policy "shipping_rates admin all" on public.shipping_rates
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.site_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_banners enable row level security;
create policy "site_banners select all" on public.site_banners
  for select using (true);
create policy "site_banners admin all" on public.site_banners
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists resend_status text;
alter table public.orders add column if not exists resend_notes text;
alter table public.orders add column if not exists resend_requested_at timestamptz;
alter table public.orders add column if not exists resend_sent_at timestamptz;

insert into public.shipping_rates (state, label, price, delivery_days_min, delivery_days_max) values
  ('SP','Padrão',60,3,5),('RJ','Padrão',70,4,7),('MG','Padrão',70,4,7),('ES','Padrão',75,5,8),
  ('PR','Padrão',75,5,8),('SC','Padrão',80,5,8),('RS','Padrão',85,5,9),('BA','Padrão',90,6,10),
  ('GO','Padrão',85,5,9),('DF','Padrão',85,5,9),('MS','Padrão',95,6,10),('MT','Padrão',95,6,10),
  ('PE','Padrão',100,7,12),('CE','Padrão',100,7,12),('PB','Padrão',105,7,12),('RN','Padrão',105,7,12),
  ('AL','Padrão',105,7,12),('SE','Padrão',105,7,12),('PI','Padrão',110,8,13),('MA','Padrão',110,8,13),
  ('TO','Padrão',110,8,13),('PA','Padrão',120,9,15),('AP','Padrão',130,10,16),('AM','Padrão',130,10,16),
  ('RR','Padrão',140,11,18),('RO','Padrão',130,10,16),('AC','Padrão',140,11,18)
on conflict (state, label) do nothing;
