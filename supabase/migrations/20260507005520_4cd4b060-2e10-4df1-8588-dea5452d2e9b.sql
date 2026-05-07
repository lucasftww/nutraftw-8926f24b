-- 1) Tabela de marcas
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone views brands" ON public.brands;
CREATE POLICY "Anyone views brands" ON public.brands
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage brands" ON public.brands;
CREATE POLICY "Admins manage brands" ON public.brands
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Coluna brand_id em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);

-- 3) Seed das marcas mais frequentes nos nomes atuais
INSERT INTO public.brands (name, slug, display_order) VALUES
  ('Synedica',       'synedica',       10),
  ('ZPHC',           'zphc',           20),
  ('Veltrane',       'veltrane',       30),
  ('Cooper Pharma',  'cooper-pharma',  40),
  ('Pharmacom Labs', 'pharmacom-labs', 50),
  ('Alluvi',         'alluvi',         60),
  ('Oxygen',         'oxygen',         70),
  ('TNL',            'tnl',            80),
  ('Neo Peptides',   'neo-peptides',   90),
  ('Med Plus',       'med-plus',      100),
  ('Safe Pro Labs',  'safe-pro-labs', 110),
  ('Pure Health',    'pure-health',   120),
  ('Dysport',        'dysport',       130),
  ('Quimfa',         'quimfa',        140)
ON CONFLICT (slug) DO NOTHING;

-- 4) Vincular produtos existentes às marcas detectadas no nome
UPDATE public.products p SET brand_id = b.id
FROM public.brands b
WHERE p.brand_id IS NULL AND (
  (b.slug = 'synedica'       AND p.name ILIKE '%synedica%')
  OR (b.slug = 'zphc'           AND (p.name ILIKE '%zphc%' OR p.name ILIKE '%zptrop%'))
  OR (b.slug = 'veltrane'       AND p.name ILIKE '%veltrane%')
  OR (b.slug = 'cooper-pharma'  AND p.name ILIKE '%cooper pharma%')
  OR (b.slug = 'pharmacom-labs' AND p.name ILIKE '%pharmacom%')
  OR (b.slug = 'alluvi'         AND p.name ILIKE '%alluvi%')
  OR (b.slug = 'oxygen'         AND p.name ILIKE '%oxygen%')
  OR (b.slug = 'tnl'            AND p.name ILIKE '%tnl%')
  OR (b.slug = 'neo-peptides'   AND p.name ILIKE '%neo peptides%')
  OR (b.slug = 'med-plus'       AND p.name ILIKE '%med plus%')
  OR (b.slug = 'safe-pro-labs'  AND p.name ILIKE '%safeprolabs%')
  OR (b.slug = 'pure-health'    AND p.name ILIKE '%pure health%')
  OR (b.slug = 'dysport'        AND p.name ILIKE '%dysport%')
  OR (b.slug = 'quimfa'         AND p.name ILIKE '%quimfa%')
);