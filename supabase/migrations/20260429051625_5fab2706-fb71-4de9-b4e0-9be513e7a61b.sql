-- =====================================================================
-- Audit profundo: recupera tabelas/RPCs ausentes e endurece segurança.
-- Tudo idempotente — pode ser re-executado sem efeito colateral.
-- =====================================================================

-- 1) Tabela de cupons
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
drop policy if exists "coupons select active for everyone" on public.coupons;
create policy "coupons select active for everyone" on public.coupons
  for select using (active = true or public.has_role(auth.uid(), 'admin'));
drop policy if exists "coupons admin all" on public.coupons;
create policy "coupons admin all" on public.coupons
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2) Tabela de fretes por UF
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
create unique index if not exists shipping_rates_state_label_unique
  on public.shipping_rates (state, label);
alter table public.shipping_rates enable row level security;
drop policy if exists "shipping_rates select all" on public.shipping_rates;
create policy "shipping_rates select all" on public.shipping_rates
  for select using (true);
drop policy if exists "shipping_rates admin all" on public.shipping_rates;
create policy "shipping_rates admin all" on public.shipping_rates
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 3) Banners do site
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
drop policy if exists "site_banners select all" on public.site_banners;
create policy "site_banners select all" on public.site_banners
  for select using (true);
drop policy if exists "site_banners admin all" on public.site_banners;
create policy "site_banners admin all" on public.site_banners
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 4) site_settings (key/value) com valores iniciais
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "site_settings select all" on public.site_settings;
create policy "site_settings select all" on public.site_settings
  for select using (true);
drop policy if exists "site_settings admin all" on public.site_settings;
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

-- 5) Resend logs (auditoria de reenvios de pedido)
create table if not exists public.resend_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid,
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists resend_logs_order_id_idx on public.resend_logs (order_id);
alter table public.resend_logs enable row level security;
drop policy if exists "resend_logs admin all" on public.resend_logs;
create policy "resend_logs admin all" on public.resend_logs
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "resend_logs user view own" on public.resend_logs;
create policy "resend_logs user view own" on public.resend_logs
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = resend_logs.order_id and o.user_id = auth.uid()
    )
  );

-- 6) Colunas auxiliares em orders (idempotente)
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists resend_status text;
alter table public.orders add column if not exists resend_notes text;
alter table public.orders add column if not exists resend_requested_at timestamptz;
alter table public.orders add column if not exists resend_sent_at timestamptz;

-- 7) Índices úteis em tabelas de hot path
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists cart_items_user_id_idx on public.cart_items (user_id);
create index if not exists products_is_active_idx on public.products (is_active);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_featured_idx on public.products (is_featured) where is_featured = true;

-- 8) Triggers de updated_at em tabelas que ainda não tinham
do $$
declare
  t text;
  tables text[] := array[
    'coupons','shipping_rates','site_banners','site_settings'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      drop trigger if exists set_updated_at on public.%I;
      create trigger set_updated_at before update on public.%I
        for each row execute function public.update_updated_at_column();
    $f$, t, t);
  end loop;
end $$;

-- 9) RPC create_order — versão final com trava de estoque
create or replace function public.create_order(
  p_items jsonb,
  p_shipping_id uuid,
  p_insurance boolean,
  p_coupon_code text,
  p_payment_method text,
  p_full_name text,
  p_cpf text,
  p_phone text,
  p_zip text,
  p_street text,
  p_number text,
  p_complement text,
  p_district text,
  p_city text,
  p_state text,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $FUNC$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_shipping numeric := 80;
  v_insurance numeric := 0;
  v_discount numeric := 0;
  v_pix_discount numeric := 0;
  v_total numeric := 0;
  v_coupon record;
  v_coupon_code text := null;
  v_item jsonb;
  v_product record;
  v_qty int;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;
  if p_payment_method not in ('pix','credit_card','boleto') then
    raise exception 'Método de pagamento inválido';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then raise exception 'Quantidade inválida'; end if;
    select id, name, image_url, price, sale_price, stock, is_active
      into v_product from public.products
      where id = (v_item->>'product_id')::uuid
      for update;
    if not found or not v_product.is_active then
      raise exception 'Produto não encontrado ou inativo';
    end if;
    if v_product.stock is not null and v_product.stock < v_qty then
      raise exception 'Estoque insuficiente para %', v_product.name;
    end if;
    v_subtotal := v_subtotal + v_qty * coalesce(
      case when v_product.sale_price is not null
                and v_product.sale_price > 0
                and v_product.sale_price < v_product.price
           then v_product.sale_price else v_product.price end, 0);
  end loop;

  if p_shipping_id is not null then
    select price into v_shipping from public.shipping_rates
      where id = p_shipping_id and active = true;
    if not found then v_shipping := 80; end if;
  end if;

  if p_insurance then
    v_insurance := round(v_subtotal * 0.10, 2);
  end if;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
      where code = upper(trim(p_coupon_code)) and active = true
      for update;
    if not found then raise exception 'Cupom inválido'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
      raise exception 'Cupom expirado';
    end if;
    if v_coupon.max_uses is not null and v_coupon.uses >= v_coupon.max_uses then
      raise exception 'Cupom esgotado';
    end if;
    if v_subtotal < coalesce(v_coupon.min_subtotal, 0) then
      raise exception 'Subtotal mínimo não atingido para o cupom';
    end if;
    if v_coupon.discount_type = 'percent' then
      v_discount := round(v_subtotal * v_coupon.discount_value / 100.0, 2);
    else
      v_discount := least(v_coupon.discount_value, v_subtotal);
    end if;
    v_coupon_code := v_coupon.code;
    update public.coupons set uses = uses + 1, updated_at = now() where id = v_coupon.id;
  end if;

  v_total := v_subtotal + v_shipping + v_insurance - v_discount;
  if p_payment_method = 'pix' then
    v_pix_discount := round(v_total * 0.05, 2);
    v_total := v_total - v_pix_discount;
  end if;

  insert into public.orders (
    user_id, status, payment_method, subtotal, shipping, insurance,
    discount, coupon_code, total, notes,
    shipping_full_name, shipping_cpf, shipping_phone, shipping_zip,
    shipping_street, shipping_number, shipping_complement,
    shipping_district, shipping_city, shipping_state
  ) values (
    v_user, 'pending', p_payment_method::payment_method, v_subtotal, v_shipping, v_insurance,
    v_discount, v_coupon_code, v_total, p_notes,
    p_full_name, regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'),
    regexp_replace(coalesce(p_phone,''), '\D', '', 'g'),
    regexp_replace(coalesce(p_zip,''), '\D', '', 'g'),
    p_street, p_number, p_complement, p_district, p_city, upper(p_state)
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, product_image_url, unit_price, quantity, subtotal
  )
  select v_order_id, pr.id, pr.name, pr.image_url,
    coalesce(case when pr.sale_price is not null and pr.sale_price > 0
                       and pr.sale_price < pr.price
                  then pr.sale_price else pr.price end, 0),
    (it->>'qty')::int,
    coalesce(case when pr.sale_price is not null and pr.sale_price > 0
                       and pr.sale_price < pr.price
                  then pr.sale_price else pr.price end, 0) * (it->>'qty')::int
  from jsonb_array_elements(p_items) as it
  join public.products pr on pr.id = (it->>'product_id')::uuid;

  update public.products pr
     set stock = greatest(0, pr.stock - (it->>'qty')::int)
    from jsonb_array_elements(p_items) as it
   where pr.id = (it->>'product_id')::uuid;

  return v_order_id;
end;
$FUNC$;

-- Permite somente usuários autenticados executarem o checkout
revoke all on function public.create_order(
  jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_order(
  jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- 10) Endurecer SECURITY DEFINER expostas demais
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- has_role precisa ser callable em RLS (pelo authenticator role); revogar de anon
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- 11) Seed de fretes (caso a tabela tenha sido recém-criada)
insert into public.shipping_rates (state, label, price, delivery_days_min, delivery_days_max) values
  ('SP','Padrão',60,3,5),('RJ','Padrão',70,4,7),('MG','Padrão',70,4,7),('ES','Padrão',75,5,8),
  ('PR','Padrão',75,5,8),('SC','Padrão',80,5,8),('RS','Padrão',85,5,9),('BA','Padrão',90,6,10),
  ('GO','Padrão',85,5,9),('DF','Padrão',85,5,9),('MS','Padrão',95,6,10),('MT','Padrão',95,6,10),
  ('PE','Padrão',100,7,12),('CE','Padrão',100,7,12),('PB','Padrão',105,7,12),('RN','Padrão',105,7,12),
  ('AL','Padrão',105,7,12),('SE','Padrão',105,7,12),('PI','Padrão',110,8,13),('MA','Padrão',110,8,13),
  ('TO','Padrão',110,8,13),('PA','Padrão',120,9,15),('AP','Padrão',130,10,16),('AM','Padrão',130,10,16),
  ('RR','Padrão',140,11,18),('RO','Padrão',130,10,16),('AC','Padrão',140,11,18)
on conflict (state, label) do nothing;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';