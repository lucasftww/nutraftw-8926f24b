-- Migration: rls_perf_and_security
--
-- 1. SECURITY: Revoga acesso RPC direto a funções trigger
--    (audit_log_set_user_email, track_promo_history) que nunca devem
--    ser chamadas diretamente por usuários — só por triggers internos.
--
-- 2. PERFORMANCE: Envolve auth.uid() em (select auth.uid()) em todas
--    as RLS policies sinalizadas pelo advisor (auth_rls_initplan).
--    Sem isso, auth.uid() é re-avaliado para CADA LINHA da query,
--    causando degradação de performance em tabelas grandes como orders,
--    profiles, affiliate_commissions, etc.

-- ── 1. SECURITY: revoke trigger functions from RPC ───────────────────────────
REVOKE EXECUTE ON FUNCTION public.audit_log_set_user_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_promo_history() FROM anon, authenticated;

-- ── 2. PERFORMANCE: profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── PERFORMANCE: user_roles ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── PERFORMANCE: categories ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ── PERFORMANCE: orders ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── PERFORMANCE: order_items ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage order items" ON public.order_items;
CREATE POLICY "Admins manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Users view own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = (select auth.uid())
  ));

-- ── PERFORMANCE: cart_items ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own cart" ON public.cart_items;
CREATE POLICY "Users manage own cart" ON public.cart_items
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── PERFORMANCE: affiliate_commissions ───────────────────────────────────────
DROP POLICY IF EXISTS "Admin manages commissions" ON public.affiliate_commissions;
CREATE POLICY "Admin manages commissions" ON public.affiliate_commissions
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Affiliate sees own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliate sees own commissions" ON public.affiliate_commissions
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = affiliate_user_id
    OR has_role((select auth.uid()), 'admin'::app_role)
  );

-- ── PERFORMANCE: affiliate_referrals ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manages referrals" ON public.affiliate_referrals;
CREATE POLICY "Admin manages referrals" ON public.affiliate_referrals
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin reads referrals" ON public.affiliate_referrals;
CREATE POLICY "Admin reads referrals" ON public.affiliate_referrals
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "User registers own referral on signup" ON public.affiliate_referrals;
CREATE POLICY "User registers own referral on signup" ON public.affiliate_referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = (select auth.uid()));

-- ── PERFORMANCE: resend_logs ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "resend_logs admin all" ON public.resend_logs;
CREATE POLICY "resend_logs admin all" ON public.resend_logs
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "resend_logs user view own" ON public.resend_logs;
CREATE POLICY "resend_logs user view own" ON public.resend_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = resend_logs.order_id
      AND o.user_id = (select auth.uid())
  ));

-- ── PERFORMANCE: coupons ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coupons admin all" ON public.coupons;
CREATE POLICY "coupons admin all" ON public.coupons
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ── PERFORMANCE: shipping_rates ───────────────────────────────────────────────
DROP POLICY IF EXISTS "shipping_rates admin all" ON public.shipping_rates;
CREATE POLICY "shipping_rates admin all" ON public.shipping_rates
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ── PERFORMANCE: site_settings ────────────────────────────────────────────────
DROP POLICY IF EXISTS "site_settings admin all" ON public.site_settings;
CREATE POLICY "site_settings admin all" ON public.site_settings
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ── PERFORMANCE: product_events ───────────────────────────────────────────────
DROP POLICY IF EXISTS "admins read events" ON public.product_events;
CREATE POLICY "admins read events" ON public.product_events
  FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
