-- 1. Novas colunas de auditoria
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS eligible_release_at timestamptz;

-- 2. Configurações default (período de carência em dias, mínimo para saque)
INSERT INTO public.site_settings (key, value)
VALUES ('affiliate_release_days', '7')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
VALUES ('affiliate_min_payout', '50')
ON CONFLICT (key) DO NOTHING;

-- 3. Helper: dias de carência
CREATE OR REPLACE FUNCTION public.affiliate_release_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(value,'')::int, 7)
  FROM public.site_settings WHERE key = 'affiliate_release_days'
  UNION ALL SELECT 7
  LIMIT 1
$$;

-- 4. Atualiza trigger do pedido para definir eligible_release_at no insert
CREATE OR REPLACE FUNCTION public.handle_order_status_for_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_ref_code text;
  v_affiliate_user_id uuid;
  v_amount numeric;
  v_release_days int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' THEN
    IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE order_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT referred_by_code INTO v_ref_code
      FROM public.profiles WHERE user_id = NEW.user_id;
    IF v_ref_code IS NULL OR length(trim(v_ref_code)) = 0 THEN RETURN NEW; END IF;

    SELECT user_id INTO v_affiliate_user_id
      FROM public.profiles WHERE affiliate_code = upper(trim(v_ref_code));
    IF v_affiliate_user_id IS NULL THEN RETURN NEW; END IF;
    IF v_affiliate_user_id = NEW.user_id THEN RETURN NEW; END IF;

    v_amount := round(coalesce(NEW.total, 0) * public.affiliate_commission_rate(), 2);
    IF v_amount <= 0 THEN RETURN NEW; END IF;

    v_release_days := public.affiliate_release_days();

    INSERT INTO public.affiliate_commissions
      (affiliate_user_id, order_id, amount, status, eligible_release_at)
    VALUES (
      v_affiliate_user_id, NEW.id, v_amount, 'pending',
      now() + make_interval(days => v_release_days)
    )
    ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING;

    UPDATE public.affiliate_referrals
       SET status = 'active', updated_at = now()
     WHERE affiliate_user_id = v_affiliate_user_id
       AND referred_user_id = NEW.user_id;
  END IF;

  IF NEW.status IN ('cancelled', 'refunded') THEN
    UPDATE public.affiliate_commissions
       SET status = 'cancelled', updated_at = now()
     WHERE order_id = NEW.id
       AND status IN ('pending', 'released');
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Função para liberar comissões maduras (pending -> released)
CREATE OR REPLACE FUNCTION public.release_due_affiliate_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
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

-- 6. Função admin para marcar como paga (released -> paid)
CREATE OR REPLACE FUNCTION public.mark_affiliate_commission_paid(p_commission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.affiliate_commissions
     SET status = 'paid',
         paid_at = now(),
         updated_at = now()
   WHERE id = p_commission_id
     AND status = 'released';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada ou não está liberada';
  END IF;
END;
$$;

-- 7. Backfill: define eligible_release_at em comissões pendentes existentes
UPDATE public.affiliate_commissions ac
   SET eligible_release_at = COALESCE(ac.eligible_release_at,
       o.updated_at + make_interval(days => public.affiliate_release_days()))
  FROM public.orders o
 WHERE ac.order_id = o.id
   AND ac.eligible_release_at IS NULL
   AND ac.status = 'pending';