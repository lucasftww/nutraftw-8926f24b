UPDATE public.shipping_rates SET delivery_days_min=2, delivery_days_max=4 WHERE state IN ('SP','RJ','MG','ES');
UPDATE public.shipping_rates SET delivery_days_min=3, delivery_days_max=5 WHERE state IN ('PR','SC','RS','DF','GO','MS','MT');
UPDATE public.shipping_rates SET delivery_days_min=4, delivery_days_max=6 WHERE state IN ('BA','SE','AL','PE','PB','RN','CE','PI','MA');
UPDATE public.shipping_rates SET delivery_days_min=5, delivery_days_max=7 WHERE state IN ('TO','PA','RO','AC','AM','RR','AP');