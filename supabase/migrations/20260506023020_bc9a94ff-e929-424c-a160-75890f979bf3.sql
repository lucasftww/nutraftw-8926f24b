CREATE OR REPLACE FUNCTION public.funnel_by_product(p_start timestamptz, p_end timestamptz, p_limit integer DEFAULT 20)
 RETURNS TABLE(product_id uuid, product_name text, product_slug text, views bigint, wishlist_adds bigint, cart_adds bigint, units_paid bigint, view_to_cart numeric, cart_to_paid numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH v AS (
    SELECT pe.product_id AS pid, count(*)::bigint AS views
    FROM public.product_events pe
    WHERE pe.event_type = 'view' AND pe.created_at BETWEEN p_start AND p_end AND pe.product_id IS NOT NULL
    GROUP BY pe.product_id
  ), w AS (
    SELECT wl.product_id AS pid, count(*)::bigint AS wadds FROM public.wishlists wl
    WHERE wl.created_at BETWEEN p_start AND p_end GROUP BY wl.product_id
  ), c AS (
    SELECT ci.product_id AS pid, count(*)::bigint AS cadds FROM public.cart_items ci
    WHERE ci.created_at BETWEEN p_start AND p_end GROUP BY ci.product_id
  ), o AS (
    SELECT oi.product_id AS pid, sum(oi.quantity)::bigint AS units
    FROM public.order_items oi JOIN public.orders ord ON ord.id = oi.order_id
    WHERE ord.status IN ('paid','processing','shipped','delivered')
      AND ord.created_at BETWEEN p_start AND p_end
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT p.id, p.name, p.slug,
    coalesce(v.views,0), coalesce(w.wadds,0), coalesce(c.cadds,0), coalesce(o.units,0),
    CASE WHEN coalesce(v.views,0)>0 THEN round(coalesce(c.cadds,0)::numeric / v.views, 4) ELSE 0 END,
    CASE WHEN coalesce(c.cadds,0)>0 THEN round(coalesce(o.units,0)::numeric / c.cadds, 4) ELSE 0 END
  FROM public.products p
  LEFT JOIN v ON v.pid = p.id
  LEFT JOIN w ON w.pid = p.id
  LEFT JOIN c ON c.pid = p.id
  LEFT JOIN o ON o.pid = p.id
  WHERE coalesce(v.views,0)+coalesce(w.wadds,0)+coalesce(c.cadds,0)+coalesce(o.units,0) > 0
  ORDER BY views DESC NULLS LAST, cart_adds DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit,20), 100));
END;
$function$;