
-- Garantia a nível de banco: 1 comissão por pedido (não-pedido fica livre)
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_order_unique
  ON public.affiliate_commissions(order_id)
  WHERE order_id IS NOT NULL;

-- Trigger atualizado: usa ON CONFLICT DO NOTHING para nunca lançar erro,
-- mesmo se outro caminho tentar inserir simultaneamente.
CREATE OR REPLACE FUNCTION public.handle_order_status_for_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_affiliate_user_id uuid;
  v_amount numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' THEN
    -- Camada 1: short-circuit (evita logs de conflito)
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

    -- Camada 2: ON CONFLICT — blindagem contra race condition entre dois
    -- updates concorrentes que passem o EXISTS quase ao mesmo tempo.
    INSERT INTO public.affiliate_commissions
      (affiliate_user_id, order_id, amount, status)
    VALUES (v_affiliate_user_id, NEW.id, v_amount, 'pending')
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
$$;
