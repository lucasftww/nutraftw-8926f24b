-- Revoga EXECUTE de PUBLIC em todas as funções SECURITY DEFINER do schema public.
-- Em seguida, concede EXECUTE apenas onde o frontend (role authenticated) precisa chamar.
-- Funções usadas apenas internamente por RLS/triggers (has_role, set_affiliate_code,
-- handle_new_user, etc.) continuam funcionando porque o Postgres as executa no
-- contexto da própria policy/trigger, não via PostgREST.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_commissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_commission_rate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.affiliate_release_days() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_referred_by_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_status_for_affiliate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_coupon_on_order_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, jsonb) FROM PUBLIC, anon;

-- Concede apenas o necessário para o site/admin (authenticated):
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, uuid, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_commission_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) TO authenticated;