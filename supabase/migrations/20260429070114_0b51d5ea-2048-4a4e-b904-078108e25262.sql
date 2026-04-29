-- =====================================================================
-- 1) Tabela de eventos de funil
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.product_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL CHECK (event_type IN ('view', 'checkout_started')),
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  user_id     uuid,                       -- nulo quando anônimo
  session_id  text,                       -- chave anônima (localStorage) p/ deduplicar
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices p/ as agregações do funil
CREATE INDEX IF NOT EXISTS idx_product_events_created_at
  ON public.product_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_event_created
  ON public.product_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_product
  ON public.product_events (product_id, event_type);

-- =====================================================================
-- 2) RLS
-- =====================================================================
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

-- INSERT: qualquer um (anon + authenticated) — necessário p/ rastrear views anônimas.
-- Pequeno guard: event_type tem CHECK na coluna; product_id é validado por FK.
CREATE POLICY "anyone can insert events"
  ON public.product_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (event_type IN ('view', 'checkout_started'));

-- SELECT: somente admin
CREATE POLICY "admins read events"
  ON public.product_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- UPDATE / DELETE: ninguém (eventos imutáveis). Sem policy = bloqueado.

-- =====================================================================
-- 3) RPC: funnel_summary — totais agregados do funil
-- =====================================================================
CREATE OR REPLACE FUNCTION public.funnel_summary(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  views              bigint,
  unique_viewers     bigint,
  wishlist_adds      bigint,
  cart_adds          bigint,
  checkout_started   bigint,
  orders_paid        bigint,
  orders_total       bigint,
  revenue_paid       numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.product_events
       WHERE event_type = 'view' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(DISTINCT coalesce(user_id::text, session_id)) FROM public.product_events
       WHERE event_type = 'view' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.wishlists
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.cart_items
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.product_events
       WHERE event_type = 'checkout_started' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.orders
       WHERE status = 'paid' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.orders
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT coalesce(sum(total), 0) FROM public.orders
       WHERE status = 'paid' AND created_at BETWEEN p_start AND p_end);
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_summary(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.funnel_summary(timestamptz, timestamptz) TO authenticated;

-- =====================================================================
-- 4) RPC: funnel_by_product — breakdown por produto
-- =====================================================================
CREATE OR REPLACE FUNCTION public.funnel_by_product(
  p_start timestamptz,
  p_end   timestamptz,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  product_id      uuid,
  product_name    text,
  product_slug    text,
  views           bigint,
  wishlist_adds   bigint,
  cart_adds       bigint,
  units_paid      bigint,
  view_to_cart    numeric,   -- 0..1
  cart_to_paid    numeric    -- 0..1
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH v AS (
    SELECT product_id, count(*)::bigint AS views
    FROM public.product_events
    WHERE event_type = 'view'
      AND created_at BETWEEN p_start AND p_end
      AND product_id IS NOT NULL
    GROUP BY product_id
  ),
  w AS (
    SELECT product_id, count(*)::bigint AS wadds
    FROM public.wishlists
    WHERE created_at BETWEEN p_start AND p_end
    GROUP BY product_id
  ),
  c AS (
    SELECT product_id, count(*)::bigint AS cadds
    FROM public.cart_items
    WHERE created_at BETWEEN p_start AND p_end
    GROUP BY product_id
  ),
  o AS (
    SELECT oi.product_id, sum(oi.quantity)::bigint AS units
    FROM public.order_items oi
    JOIN public.orders ord ON ord.id = oi.order_id
    WHERE ord.status = 'paid'
      AND ord.created_at BETWEEN p_start AND p_end
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT
    p.id,
    p.name,
    p.slug,
    coalesce(v.views, 0)            AS views,
    coalesce(w.wadds, 0)            AS wishlist_adds,
    coalesce(c.cadds, 0)            AS cart_adds,
    coalesce(o.units, 0)            AS units_paid,
    CASE WHEN coalesce(v.views,0) > 0
         THEN round(coalesce(c.cadds,0)::numeric / v.views, 4)
         ELSE 0 END                 AS view_to_cart,
    CASE WHEN coalesce(c.cadds,0) > 0
         THEN round(coalesce(o.units,0)::numeric / c.cadds, 4)
         ELSE 0 END                 AS cart_to_paid
  FROM public.products p
  LEFT JOIN v ON v.product_id = p.id
  LEFT JOIN w ON w.product_id = p.id
  LEFT JOIN c ON c.product_id = p.id
  LEFT JOIN o ON o.product_id = p.id
  WHERE coalesce(v.views,0) + coalesce(w.wadds,0) + coalesce(c.cadds,0) + coalesce(o.units,0) > 0
  ORDER BY views DESC NULLS LAST, cart_adds DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.funnel_by_product(timestamptz, timestamptz, integer) TO authenticated;