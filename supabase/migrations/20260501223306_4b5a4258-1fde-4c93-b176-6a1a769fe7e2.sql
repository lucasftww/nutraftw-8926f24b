-- Índices duplicados (mesma coluna, mesma ordenação) — remove redundantes.
DROP INDEX IF EXISTS public.idx_products_category;     -- mantém products_category_id_idx
DROP INDEX IF EXISTS public.idx_products_active;       -- mantém products_is_active_idx
DROP INDEX IF EXISTS public.idx_orders_status;         -- mantém orders_status_idx
DROP INDEX IF EXISTS public.idx_orders_user;           -- mantém orders_user_id_idx
DROP INDEX IF EXISTS public.idx_order_items_order;     -- mantém order_items_order_id_idx
DROP INDEX IF EXISTS public.idx_cart_user;             -- mantém cart_items_user_id_idx