-- ============================================================
-- 1) Proteger referred_email no affiliate_referrals
-- ============================================================
-- Remove a policy ampla atual e cria uma só para admins (acesso direto à tabela).
DROP POLICY IF EXISTS "Affiliate sees own referrals" ON public.affiliate_referrals;

-- Admins continuam com acesso total (já existe "Admin manages referrals" ALL).
-- Afiliados acessam APENAS via VIEW mascarada abaixo.

-- View mascarada: e-mail vira "ab***@dominio.com"
CREATE OR REPLACE VIEW public.affiliate_referrals_masked
WITH (security_invoker = true)
AS
SELECT
  id,
  affiliate_user_id,
  referred_user_id,
  -- mascara local-part: mantém 2 primeiros chars + ***
  CASE
    WHEN referred_email IS NULL OR position('@' in referred_email) = 0 THEN NULL
    ELSE
      substr(split_part(referred_email, '@', 1), 1, 2)
      || '***@'
      || split_part(referred_email, '@', 2)
  END AS referred_email_masked,
  status,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  landing_path,
  referrer,
  created_at,
  updated_at
FROM public.affiliate_referrals
WHERE affiliate_user_id = auth.uid()
   OR public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.affiliate_referrals_masked TO authenticated;

-- ============================================================
-- 2) Esconder a tabela coupons; validar via RPC
-- ============================================================
DROP POLICY IF EXISTS "coupons select active for authenticated" ON public.coupons;
-- Restam só as policies de admin. Usuários comuns não leem mais a tabela.

-- RPC pública para validar 1 cupom específico (não enumera).
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_subtotal numeric)
RETURNS TABLE(
  valid boolean,
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_amount numeric := 0;
  v_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF v_code = '' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::numeric, 0::numeric, 'Informe um código.'::text;
    RETURN;
  END IF;

  SELECT * INTO v FROM public.coupons WHERE code = v_code;
  IF NOT FOUND OR NOT v.active THEN
    RETURN QUERY SELECT false, v_code, NULL::text, NULL::text, NULL::numeric, 0::numeric, 'Cupom inválido.'::text;
    RETURN;
  END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at < now() THEN
    RETURN QUERY SELECT false, v_code, NULL::text, NULL::text, NULL::numeric, 0::numeric, 'Cupom expirado.'::text;
    RETURN;
  END IF;
  IF v.max_uses IS NOT NULL AND v.uses >= v.max_uses THEN
    RETURN QUERY SELECT false, v_code, NULL::text, NULL::text, NULL::numeric, 0::numeric, 'Cupom esgotado.'::text;
    RETURN;
  END IF;
  IF coalesce(p_subtotal,0) < coalesce(v.min_subtotal,0) THEN
    RETURN QUERY SELECT false, v_code, v.description, v.discount_type, v.discount_value, 0::numeric,
      ('Subtotal mínimo de R$ ' || replace(v.min_subtotal::text,'.',','))::text;
    RETURN;
  END IF;

  IF v.discount_type = 'percent' THEN
    v_amount := round(coalesce(p_subtotal,0) * v.discount_value / 100.0, 2);
  ELSE
    v_amount := least(v.discount_value, coalesce(p_subtotal,0));
  END IF;

  RETURN QUERY SELECT true, v.code, v.description, v.discount_type, v.discount_value, v_amount, 'Cupom aplicado.'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated;

-- ============================================================
-- 3) SECURITY DEFINER executável: revogar EXECUTE de funções
--    sensíveis para `public` (deixar apenas onde faz sentido).
-- ============================================================
-- Funções administrativas: somente authenticated (a checagem de admin é interna).
REVOKE ALL ON FUNCTION public.admin_set_order_status(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_affiliate_commission_paid(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.funnel_summary(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.release_due_affiliate_commissions() FROM public, anon, authenticated;

-- create_order: precisa permanecer chamável por authenticated (checkout autocria conta).
REVOKE ALL ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
