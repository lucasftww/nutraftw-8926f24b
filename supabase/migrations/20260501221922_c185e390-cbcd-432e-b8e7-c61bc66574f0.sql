-- 1) Remover feature de banners (não há slot no catálogo)
DROP TABLE IF EXISTS public.home_banners CASCADE;

-- 2) SEO por produto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;

-- 3) Hardening: revogar EXECUTE de funções SECURITY DEFINER admin-only
REVOKE EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_commissions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) FROM anon, authenticated;

-- Conceder somente ao service_role (usado por edge functions admin)
GRANT EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_due_affiliate_commissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) TO service_role;