CREATE OR REPLACE FUNCTION public.funnel_summary(p_start timestamptz, p_end timestamptz)
 RETURNS TABLE(views bigint, unique_viewers bigint, wishlist_adds bigint, cart_adds bigint, checkout_started bigint, orders_paid bigint, orders_total bigint, revenue_paid numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.product_events
       WHERE event_type = 'view' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(DISTINCT coalesce(user_id::text, session_id)) FROM public.product_events
       WHERE event_type = 'view' AND created_at BETWEEN p_start AND p_end
         AND (user_id IS NOT NULL OR session_id IS NOT NULL)),
    (SELECT count(*) FROM public.wishlists
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.cart_items
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.product_events
       WHERE event_type = 'checkout_started' AND created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.orders
       WHERE status IN ('paid','processing','shipped','delivered') AND created_at BETWEEN p_start AND p_end),
    (SELECT count(*) FROM public.orders
       WHERE created_at BETWEEN p_start AND p_end),
    (SELECT coalesce(sum(total), 0) FROM public.orders
       WHERE status IN ('paid','processing','shipped','delivered') AND created_at BETWEEN p_start AND p_end);
END;
$function$;

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
    SELECT product_id, count(*)::bigint AS views
    FROM public.product_events
    WHERE event_type = 'view' AND created_at BETWEEN p_start AND p_end AND product_id IS NOT NULL
    GROUP BY product_id
  ), w AS (
    SELECT product_id, count(*)::bigint AS wadds FROM public.wishlists
    WHERE created_at BETWEEN p_start AND p_end GROUP BY product_id
  ), c AS (
    SELECT product_id, count(*)::bigint AS cadds FROM public.cart_items
    WHERE created_at BETWEEN p_start AND p_end GROUP BY product_id
  ), o AS (
    SELECT oi.product_id, sum(oi.quantity)::bigint AS units
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
  LEFT JOIN v ON v.product_id = p.id
  LEFT JOIN w ON w.product_id = p.id
  LEFT JOIN c ON c.product_id = p.id
  LEFT JOIN o ON o.product_id = p.id
  WHERE coalesce(v.views,0)+coalesce(w.wadds,0)+coalesce(c.cadds,0)+coalesce(o.units,0) > 0
  ORDER BY views DESC NULLS LAST, cart_adds DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit,20), 100));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_top_wishlist(p_days integer DEFAULT 30, p_limit integer DEFAULT 50)
 RETURNS TABLE(product_id uuid, product_name text, product_slug text, product_image_url text, price numeric, sale_price numeric, stock integer, is_active boolean, is_on_offer boolean, wishlist_count bigint, unique_users bigint, cart_count bigint, units_paid bigint, last_added_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH window_range AS (
    SELECT (now() - make_interval(days => greatest(1, coalesce(p_days, 30))))::timestamptz AS since
  ), w AS (
    SELECT wl.product_id, count(*)::bigint AS wishlist_count,
           count(DISTINCT wl.user_id)::bigint AS unique_users,
           max(wl.created_at) AS last_added_at
    FROM public.wishlists wl, window_range wr
    WHERE wl.created_at >= wr.since GROUP BY wl.product_id
  ), c AS (
    SELECT ci.product_id, count(*)::bigint AS cart_count
    FROM public.cart_items ci, window_range wr
    WHERE ci.created_at >= wr.since GROUP BY ci.product_id
  ), o AS (
    SELECT oi.product_id, sum(oi.quantity)::bigint AS units_paid
    FROM public.order_items oi
    JOIN public.orders ord ON ord.id = oi.order_id, window_range wr
    WHERE ord.status IN ('paid','processing','shipped','delivered')
      AND ord.created_at >= wr.since AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT p.id, p.name, p.slug, p.image_url, p.price, p.sale_price, p.stock, p.is_active, p.is_on_offer,
    coalesce(w.wishlist_count,0), coalesce(w.unique_users,0),
    coalesce(c.cart_count,0), coalesce(o.units_paid,0), w.last_added_at
  FROM public.products p
  LEFT JOIN w ON w.product_id = p.id
  LEFT JOIN c ON c.product_id = p.id
  LEFT JOIN o ON o.product_id = p.id
  WHERE coalesce(w.wishlist_count,0) > 0
  ORDER BY w.wishlist_count DESC NULLS LAST, w.unique_users DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200));
END;
$function$;