ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_new_release boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_on_offer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_new_release ON public.products (is_new_release) WHERE is_new_release = true;
CREATE INDEX IF NOT EXISTS idx_products_is_on_offer ON public.products (is_on_offer) WHERE is_on_offer = true;