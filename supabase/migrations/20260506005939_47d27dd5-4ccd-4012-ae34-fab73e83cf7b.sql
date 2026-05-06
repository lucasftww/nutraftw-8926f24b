-- Índices compostos para escalar
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_created ON public.wishlists (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_created ON public.cart_items (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_events_user_session ON public.product_events (user_id, session_id) WHERE event_type = 'view';

-- Stats agregadas para o Dashboard (substitui o load full-scan no client)
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_paid_statuses order_status[] := ARRAY['paid','processing','shipped','delivered']::order_status[];
  v_since_24h timestamptz := now() - interval '24 hours';
  v_total_revenue numeric;
  v_paid_count bigint;
  v_total_orders bigint;
  v_pending bigint;
  v_items_sold bigint;
  v_total_products bigint;
  v_low_stock bigint;
  v_total_customers bigint;
  v_recent_orders jsonb;
  v_top_products jsonb;
  v_l24_orders bigint;
  v_l24_paid bigint;
  v_l24_revenue numeric;
  v_l24_views bigint;
  v_l24_checkout bigint;
  v_l24_wishlist bigint;
  v_l24_cart bigint;
  v_l24_recent_sales jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total_orders FROM public.orders;
  SELECT count(*) INTO v_pending FROM public.orders WHERE status = 'pending';
  SELECT count(*), coalesce(sum(total),0)
    INTO v_paid_count, v_total_revenue
    FROM public.orders WHERE status = ANY(v_paid_statuses);
  SELECT coalesce(sum(oi.quantity),0) INTO v_items_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status = ANY(v_paid_statuses);
  SELECT count(*) INTO v_total_products FROM public.products;
  SELECT count(*) INTO v_low_stock FROM public.products WHERE stock < 5;
  SELECT count(*) INTO v_total_customers FROM public.profiles;

  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_recent_orders FROM (
    SELECT id, total, status, created_at, shipping_full_name
    FROM public.orders ORDER BY created_at DESC LIMIT 5
  ) t;

  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_top_products FROM (
    SELECT oi.product_id AS id, max(oi.product_name) AS name,
           max(oi.product_image_url) AS image,
           sum(oi.quantity)::int AS qty,
           sum(oi.subtotal)::numeric AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status = ANY(v_paid_statuses)
    GROUP BY oi.product_id
    ORDER BY sum(oi.subtotal) DESC NULLS LAST
    LIMIT 5
  ) t;

  -- 24h
  SELECT count(*) INTO v_l24_orders FROM public.orders WHERE created_at >= v_since_24h;
  SELECT count(*), coalesce(sum(total),0)
    INTO v_l24_paid, v_l24_revenue
    FROM public.orders WHERE created_at >= v_since_24h AND status = ANY(v_paid_statuses);
  SELECT count(*) FILTER (WHERE event_type='view'),
         count(*) FILTER (WHERE event_type='checkout_started')
    INTO v_l24_views, v_l24_checkout
    FROM public.product_events WHERE created_at >= v_since_24h;
  SELECT count(*) INTO v_l24_wishlist FROM public.wishlists WHERE created_at >= v_since_24h;
  SELECT count(*) INTO v_l24_cart FROM public.cart_items WHERE created_at >= v_since_24h;

  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_l24_recent_sales FROM (
    SELECT id, total, status::text, created_at, shipping_full_name
    FROM public.orders WHERE created_at >= v_since_24h
    ORDER BY created_at DESC LIMIT 6
  ) t;

  RETURN jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'paid_orders_count', v_paid_count,
    'aov', CASE WHEN v_paid_count > 0 THEN round(v_total_revenue / v_paid_count, 2) ELSE 0 END,
    'items_sold', v_items_sold,
    'pending_orders', v_pending,
    'total_products', v_total_products,
    'low_stock', v_low_stock,
    'total_customers', v_total_customers,
    'recent_orders', v_recent_orders,
    'top_products', v_top_products,
    'last24h', jsonb_build_object(
      'orders_count', v_l24_orders,
      'paid_count', v_l24_paid,
      'revenue', v_l24_revenue,
      'views', v_l24_views,
      'wishlist', v_l24_wishlist,
      'cart_adds', v_l24_cart,
      'checkout_started', v_l24_checkout,
      'recent_sales', v_l24_recent_sales
    )
  );
END;
$$;