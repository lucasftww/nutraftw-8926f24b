-- Remover produto "Água Bacteriostática 2ml" (e variantes 2ml)
DELETE FROM public.products
WHERE name ILIKE '%bacteriost%2 ml%'
   OR name ILIKE '%bacteriost%2ml%'
   OR slug ILIKE '%bacteriostatica-2%';

-- Remover categoria "Celular Eletrônica" (e variações)
-- Primeiro, desvincula produtos restantes para não quebrar FK
UPDATE public.products
SET category_id = NULL
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE name ILIKE '%celular%' OR name ILIKE '%eletr%nica%' OR name ILIKE '%eletronica%'
);

DELETE FROM public.categories
WHERE name ILIKE '%celular%' OR name ILIKE '%eletr%nica%' OR name ILIKE '%eletronica%';