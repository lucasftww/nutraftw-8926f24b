-- =====================================================================
-- Fix #1: Garante que public.site_settings existe (idempotente) e força
-- recarga do schema cache do PostgREST. Algumas instâncias remotas não
-- recarregaram o cache após a migração original e estavam retornando 404.
-- =====================================================================
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

-- =====================================================================
-- Fix #2: RPC create_order — o desconto PIX estava sendo somado ao campo
-- `discount` da ordem, inflando os relatórios. Agora `discount` guarda
-- apenas o desconto de cupom, e o desconto PIX é refletido apenas em
-- `total` (e fica derivável por: subtotal+shipping+insurance-discount-total).
-- =====================================================================
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
as $$
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then raise exception 'Quantidade inválida'; end if;
    select id, name, image_url, price, sale_price, stock, is_active
      into v_product from public.products
      where id = (v_item->>'product_id')::uuid;
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
$$;

grant execute on function public.create_order(
  jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- Recarrega o schema cache do PostgREST para que site_settings fique disponível imediatamente
notify pgrst, 'reload schema';
