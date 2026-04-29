
-- Taxa de comissão (1%). Centralizada para fácil ajuste futuro.
CREATE OR REPLACE FUNCTION public.affiliate_commission_rate()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 0.01::numeric $$;

-- Trigger principal: ao mudar status para 'paid', cria comissão.
-- Ao mudar para 'cancelled'/'refunded', cancela comissões pendentes do pedido.
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
  -- Só age em UPDATE de status (ou primeiro INSERT já 'paid').
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- ───── Pedido pago → cria comissão (idempotente) ─────
  IF NEW.status = 'paid' THEN
    -- Já existe comissão para este pedido? Não duplica.
    IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE order_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Quem indicou este comprador?
    SELECT referred_by_code INTO v_ref_code
      FROM public.profiles
     WHERE user_id = NEW.user_id;

    IF v_ref_code IS NULL OR length(trim(v_ref_code)) = 0 THEN
      RETURN NEW;
    END IF;

    -- Resolve afiliado dono do código.
    SELECT user_id INTO v_affiliate_user_id
      FROM public.profiles
     WHERE affiliate_code = upper(trim(v_ref_code));

    IF v_affiliate_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Auto-indicação não gera comissão.
    IF v_affiliate_user_id = NEW.user_id THEN
      RETURN NEW;
    END IF;

    v_amount := round(coalesce(NEW.total, 0) * public.affiliate_commission_rate(), 2);
    IF v_amount <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.affiliate_commissions
      (affiliate_user_id, order_id, amount, status)
    VALUES
      (v_affiliate_user_id, NEW.id, v_amount, 'pending');

    -- Marca a indicação como ativa (primeira compra paga do indicado).
    UPDATE public.affiliate_referrals
       SET status = 'active', updated_at = now()
     WHERE affiliate_user_id = v_affiliate_user_id
       AND referred_user_id = NEW.user_id;
  END IF;

  -- ───── Pedido cancelado/reembolsado → cancela comissão pendente ─────
  IF NEW.status IN ('cancelled', 'refunded') THEN
    UPDATE public.affiliate_commissions
       SET status = 'cancelled', updated_at = now()
     WHERE order_id = NEW.id
       AND status IN ('pending', 'released');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_affiliate_commission ON public.orders;
CREATE TRIGGER orders_affiliate_commission
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_for_affiliate();
