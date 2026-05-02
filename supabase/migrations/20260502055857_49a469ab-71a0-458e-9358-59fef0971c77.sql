ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS offer_order integer NOT NULL DEFAULT 1000;

CREATE INDEX IF NOT EXISTS idx_products_offer_order
  ON public.products (offer_order)
  WHERE is_on_offer = true;

-- Inicializa offer_order para os produtos atualmente em promoção,
-- mantendo a ordem cronológica (mais antigo no topo).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.products
  WHERE is_on_offer = true
)
UPDATE public.products p
SET offer_order = r.rn * 10
FROM ranked r
WHERE p.id = r.id;