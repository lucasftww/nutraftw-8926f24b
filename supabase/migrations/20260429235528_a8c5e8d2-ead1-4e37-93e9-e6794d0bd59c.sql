
-- 1) Remove INSERT direto em orders/order_items (fraude de comissão)
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own order items" ON public.order_items;

-- 2) Restringe leitura de cupons apenas a usuários autenticados
DROP POLICY IF EXISTS "coupons select active for everyone" ON public.coupons;
CREATE POLICY "coupons select active for authenticated"
ON public.coupons
FOR SELECT
TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Revoga EXECUTE de anon/PUBLIC para funções SECURITY DEFINER que não devem ser públicas.
--    Mantemos EXECUTE para authenticated apenas onde realmente é chamada do app.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_commission_rate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_release_days() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_status_for_affiliate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_commissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_referred_by_code() FROM PUBLIC, anon, authenticated;

-- Funções chamadas do app (RPC) — restringe a authenticated apenas
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) FROM PUBLIC, anon;

-- 4) Corrige search_path da função utilitária rls_auto_enable
ALTER FUNCTION public.rls_auto_enable() SET search_path = public, pg_catalog;
