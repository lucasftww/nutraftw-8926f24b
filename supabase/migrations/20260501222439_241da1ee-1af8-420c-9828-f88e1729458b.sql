-- 1) Restringir policies "admin ALL" de {public} para {authenticated}
DROP POLICY IF EXISTS "Admin manages commissions" ON public.affiliate_commissions;
CREATE POLICY "Admin manages commissions" ON public.affiliate_commissions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Affiliate sees own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliate sees own commissions" ON public.affiliate_commissions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = affiliate_user_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin manages referrals" ON public.affiliate_referrals;
CREATE POLICY "Admin manages referrals" ON public.affiliate_referrals
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "coupons admin all" ON public.coupons;
CREATE POLICY "coupons admin all" ON public.coupons
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "resend_logs admin all" ON public.resend_logs;
CREATE POLICY "resend_logs admin all" ON public.resend_logs
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "resend_logs user view own" ON public.resend_logs;
CREATE POLICY "resend_logs user view own" ON public.resend_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = resend_logs.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS "shipping_rates admin all" ON public.shipping_rates;
CREATE POLICY "shipping_rates admin all" ON public.shipping_rates
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "site_settings admin all" ON public.site_settings;
CREATE POLICY "site_settings admin all" ON public.site_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Proteger referred_email: substituir SELECT do afiliado por uma policy
-- que só libera a coluna via VIEW. A forma mais simples é manter SELECT mas
-- expor uma view sem a coluna sensível; e revogar leitura direta da tabela
-- para afiliados não-admin restringindo via REVOKE de coluna específica.
REVOKE SELECT (referred_email) ON public.affiliate_referrals FROM authenticated;
-- Apenas service_role e admin (via SECURITY DEFINER) podem ler referred_email.
GRANT SELECT (referred_email) ON public.affiliate_referrals TO service_role;