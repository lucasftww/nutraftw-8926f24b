UPDATE public.products
SET image_url = regexp_replace(image_url, '\.jpg$', '.webp')
WHERE image_url LIKE '/products/%.jpg';