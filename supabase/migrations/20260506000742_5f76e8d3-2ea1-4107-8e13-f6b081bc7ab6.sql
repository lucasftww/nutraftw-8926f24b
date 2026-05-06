
CREATE TABLE IF NOT EXISTS public.product_promo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  original_price numeric NOT NULL,
  sale_price numeric NOT NULL,
  discount_percent numeric GENERATED ALWAYS AS (
    CASE WHEN original_price > 0
         THEN round((1 - sale_price / original_price) * 100, 2)
         ELSE 0 END
  ) STORED,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_history_product
  ON public.product_promo_history(product_id, started_at DESC);

ALTER TABLE public.product_promo_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage promo history" ON public.product_promo_history;
CREATE POLICY "Admins manage promo history"
  ON public.product_promo_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────────────────────────────────────────────────────────
-- Trigger: registra histórico automaticamente.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_promo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open uuid;
BEGIN
  -- Ativando promoção (off → on) com sale_price válido: abre período
  IF NEW.is_on_offer = true
     AND COALESCE(OLD.is_on_offer, false) = false
     AND NEW.sale_price IS NOT NULL
     AND NEW.sale_price > 0
     AND NEW.sale_price < NEW.price THEN
    INSERT INTO public.product_promo_history
      (product_id, original_price, sale_price, created_by)
    VALUES (NEW.id, NEW.price, NEW.sale_price, auth.uid());
  END IF;

  -- Mudou o preço promocional enquanto ativo: fecha o período antigo e abre novo
  IF NEW.is_on_offer = true
     AND OLD.is_on_offer = true
     AND NEW.sale_price IS NOT NULL
     AND NEW.sale_price > 0
     AND NEW.sale_price < NEW.price
     AND (OLD.sale_price IS DISTINCT FROM NEW.sale_price
          OR OLD.price IS DISTINCT FROM NEW.price) THEN
    UPDATE public.product_promo_history
       SET ended_at = now()
     WHERE product_id = NEW.id AND ended_at IS NULL;
    INSERT INTO public.product_promo_history
      (product_id, original_price, sale_price, created_by)
    VALUES (NEW.id, NEW.price, NEW.sale_price, auth.uid());
  END IF;

  -- Desativando (on → off): fecha o período aberto
  IF COALESCE(NEW.is_on_offer, false) = false
     AND OLD.is_on_offer = true THEN
    UPDATE public.product_promo_history
       SET ended_at = now()
     WHERE product_id = NEW.id AND ended_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_promo_history ON public.products;
CREATE TRIGGER trg_track_promo_history
AFTER UPDATE OF is_on_offer, sale_price, price ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.track_promo_history();

-- ──────────────────────────────────────────────────────────────────
-- RPC: reaplica a última promoção registrada para o produto.
-- Retorna o sale_price aplicado ou NULL se não houver histórico.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_last_promo(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last numeric;
  v_current_price numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT price INTO v_current_price FROM public.products WHERE id = p_product_id;
  IF v_current_price IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  SELECT sale_price INTO v_last
    FROM public.product_promo_history
   WHERE product_id = p_product_id
   ORDER BY started_at DESC
   LIMIT 1;

  IF v_last IS NULL OR v_last >= v_current_price THEN
    RETURN NULL;
  END IF;

  UPDATE public.products
     SET is_on_offer = true,
         sale_price = v_last,
         offer_order = COALESCE(
           (SELECT MAX(offer_order) + 10 FROM public.products WHERE is_on_offer = true),
           10
         ),
         updated_at = now()
   WHERE id = p_product_id;

  RETURN v_last;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_last_promo(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.apply_last_promo(uuid) TO authenticated;

-- Backfill: produtos atualmente em promoção viram um período aberto
INSERT INTO public.product_promo_history (product_id, original_price, sale_price, started_at)
SELECT id, price, sale_price, COALESCE(updated_at, now())
  FROM public.products
 WHERE is_on_offer = true
   AND sale_price IS NOT NULL
   AND sale_price > 0
   AND sale_price < price
   AND NOT EXISTS (
     SELECT 1 FROM public.product_promo_history h
      WHERE h.product_id = products.id AND h.ended_at IS NULL
   );
