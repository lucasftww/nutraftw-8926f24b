-- 1) Corrigir search_path mutable em affiliate_commission_rate
CREATE OR REPLACE FUNCTION public.affiliate_commission_rate()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$ SELECT 0.01::numeric $function$;

-- 2) Revogar EXECUTE de funções internas/triggers que não devem ser
-- expostas via PostgREST a usuários logados/anônimos. Elas continuam
-- funcionando via triggers e chamadas internas (postgres role).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_referred_by_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_status_for_affiliate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_commissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;