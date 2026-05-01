-- 1) Remove overload antigo (sem p_email) de create_order — código morto.
DROP FUNCTION IF EXISTS public.create_order(
  p_items jsonb, p_shipping_id uuid, p_insurance boolean, p_coupon_code text,
  p_payment_method text, p_full_name text, p_cpf text, p_phone text,
  p_zip text, p_street text, p_number text, p_complement text,
  p_district text, p_city text, p_state text, p_notes text
);

-- 2) Revoga EXECUTE de has_role para authenticated.
-- RLS policies chamam a função com privilégios do owner (postgres),
-- portanto continuam funcionando. Apenas chamadas RPC diretas do cliente
-- são bloqueadas — o que é o comportamento desejado.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;