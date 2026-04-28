-- Configurações globais do site (key/value)
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;

create policy "site_settings select all" on public.site_settings
  for select using (true);
create policy "site_settings admin all" on public.site_settings
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.site_settings (key, value) values
  ('checkout_enable_card', '1'),
  ('checkout_enable_pix', '1'),
  ('insurance_optional', '1'),
  ('whatsapp_number', '5511999999999'),
  ('whatsapp_message', 'Olá! Vim pelo site da GIMPORTS.'),
  ('hero_bio', 'Sua parceira no cuidado com a saúde.'),
  ('badge_new_days', '30')
on conflict (key) do nothing;
