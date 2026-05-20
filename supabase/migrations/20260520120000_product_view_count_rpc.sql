-- Migration: product_view_count_rpc
--
-- Expõe contagem agregada de visualizações de produto nas últimas 24h
-- via RPC SECURITY DEFINER. Permite mostrar "X pessoas viram nas últimas
-- 24h" como prova social na ProductDetail SEM dar SELECT direto em
-- product_events ao público (que continua admin-only por RLS).
--
-- DISTINCT session_id: contamos PESSOAS, não pageviews — evita inflação
-- por refresh ou navegação repetida do mesmo usuário.

CREATE OR REPLACE FUNCTION public.product_view_count_24h(p_product_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT session_id)::int, 0)
  FROM public.product_events
  WHERE product_id = p_product_id
    AND event_type = 'view'
    AND session_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '24 hours';
$$;

GRANT EXECUTE ON FUNCTION public.product_view_count_24h(uuid) TO anon, authenticated;
