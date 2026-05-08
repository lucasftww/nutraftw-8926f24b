-- 1) Lock down affiliate_referrals so affiliates can only read via the masked view.
DROP POLICY IF EXISTS "Affiliate sees own referrals" ON public.affiliate_referrals;

-- Only admins can SELECT directly from the table now.
DROP POLICY IF EXISTS "Admin reads referrals" ON public.affiliate_referrals;
CREATE POLICY "Admin reads referrals"
ON public.affiliate_referrals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Revoke anon EXECUTE on admin-only SECURITY DEFINER functions
--    (the in-function has_role check still raises 'forbidden' for non-admins,
--    but exposing them to anon is unnecessary attack surface).
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_top_wishlist(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_wishlist(integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_users_overview(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_overview(text, integer, integer) TO authenticated;