-- Security hardening follow-up:
-- 1) remove known QA bootstrap account if it exists
-- 2) restore affiliate referral self-access policy
-- 3) align RPC grants with admin usage in frontend

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'qa-admin@royalvita.test'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END
$$;

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliate sees own referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliate sees own referrals"
ON public.affiliate_referrals
FOR SELECT
TO authenticated
USING (auth.uid() = affiliate_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.release_due_affiliate_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH upd AS (
    UPDATE public.affiliate_commissions ac
       SET status = 'released',
           released_at = now(),
           updated_at = now()
      FROM public.orders o
     WHERE ac.order_id = o.id
       AND ac.status = 'pending'
       AND o.status = 'paid'
       AND ac.eligible_release_at IS NOT NULL
       AND ac.eligible_release_at <= now()
    RETURNING ac.id
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_commissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_due_affiliate_commissions() TO authenticated, service_role;
