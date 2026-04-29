-- 1. Permite status 'clawback'
ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_status_check;
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_status_check
  CHECK (status IN ('pending','released','paid','cancelled','clawback'));

-- 2. Auditoria de cancelamento
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 3. Trigger atualizado: cobre clawback e reativação
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

  -- ===== PEDIDO PAGO =====
  IF NEW.status = 'paid' THEN
    -- Reativação: se já existe comissão cancelada/clawback, volta para pending
    UPDATE public.affiliate_commissions
       SET status = 'pending',
           cancellation_reason = NULL,
           cancelled_at = NULL,
           eligible_release_at = COALESCE(eligible_release_at, now() + make_interval(days => public.affiliate_release_days())),
           updated_at = now()
     WHERE order_id = NEW.id
       AND status IN ('cancelled', 'clawback');

    -- Se já existe qualquer comissão (incluindo a recém-reativada), não cria nova
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

  -- ===== PEDIDO CANCELADO / REEMBOLSADO =====
  IF NEW.status IN ('cancelled', 'refunded') THEN
    -- Comissões ainda não pagas → cancelled
    UPDATE public.affiliate_commissions
       SET status = 'cancelled',
           cancelled_at = now(),
           cancellation_reason = COALESCE(cancellation_reason,
             'Pedido ' || NEW.status::text),
           updated_at = now()
     WHERE order_id = NEW.id
       AND status IN ('pending', 'released');

    -- Comissão já paga ao afiliado → clawback (estorno a cobrar)
    UPDATE public.affiliate_commissions
       SET status = 'clawback',
           cancelled_at = now(),
           cancellation_reason = COALESCE(cancellation_reason,
             'Pedido ' || NEW.status::text || ' após pagamento da comissão'),
           updated_at = now()
     WHERE order_id = NEW.id
       AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. RPC para admin alterar status com motivo auditável
CREATE OR REPLACE FUNCTION public.admin_set_order_status(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_status NOT IN ('pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  SELECT status::text INTO v_old_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  UPDATE public.orders
     SET status = p_status::order_status,
         updated_at = now()
   WHERE id = p_order_id;

  -- Propaga motivo para a comissão (se existir)
  IF p_reason IS NOT NULL AND p_status IN ('cancelled', 'refunded') THEN
    UPDATE public.affiliate_commissions
       SET cancellation_reason = p_reason,
           updated_at = now()
     WHERE order_id = p_order_id;
  END IF;

  -- Audit log
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.admin_audit_log (user_id, user_email, action, entity, entity_id, summary, diff)
  VALUES (
    auth.uid(), v_email, 'order.status_change', 'orders', p_order_id::text,
    format('Status %s → %s', v_old_status, p_status),
    jsonb_build_object('from', v_old_status, 'to', p_status, 'reason', p_reason)
  );
END;
$$;