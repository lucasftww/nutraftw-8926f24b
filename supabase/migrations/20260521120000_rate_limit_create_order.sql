-- Migration: rate_limit_create_order
--
-- Adiciona proteção contra abuso de criação de pedidos no servidor.
-- Complementa o guard client-side (`if (submitting) return`) que previne
-- apenas o duplo-clique do MESMO browser — não cobre:
--   * Múltiplas abas/devices em paralelo
--   * Replay de requisição via DevTools/curl
--   * Bots em campanhas de afiliados maliciosas
--
-- Estratégia:
--   1. Tabela `rate_limit_events` registra cada chamada (user_id, action,
--      created_at) com índice em (user_id, action, created_at).
--   2. Função `check_rate_limit(action, max_per_window, window_seconds)`
--      conta chamadas recentes e RAISE EXCEPTION se exceder.
--   3. `create_order` chama o check no início — qualquer chamada acima do
--      limite vira erro 400 (PostgreSQL P0001) que o frontend já trata.
--
-- Limite atual para create_order: 5 pedidos / 60s por usuário. Generoso
-- para uso real (cliente errou no formulário, recarrega, tenta de novo)
-- mas estanca abuso óbvio (script chamando 100x/segundo).

-- ── 1. Tabela de eventos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice de leitura para o check (filtra por user + action + janela recente)
CREATE INDEX IF NOT EXISTS rate_limit_events_lookup
  ON public.rate_limit_events (user_id, action, created_at DESC);

-- RLS: somente leitura pelo próprio usuário (admin via SECURITY DEFINER)
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sees own rate-limit events" ON public.rate_limit_events;
CREATE POLICY "User sees own rate-limit events" ON public.rate_limit_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT é feito apenas via função SECURITY DEFINER `check_rate_limit`
-- — cliente nunca insere direto, sem policy de INSERT.

-- ── 2. Função check_rate_limit ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action          text,
  p_max_per_window  integer DEFAULT 5,
  p_window_seconds  integer DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id  uuid;
  v_count    integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    -- Sem sessão autenticada não há identidade pra ratear — bloqueia.
    RAISE EXCEPTION 'rate_limit_unauthenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Conta eventos do usuário+action na janela recente
  SELECT COUNT(*)::int INTO v_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND action = p_action
    AND created_at >= NOW() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max_per_window THEN
    RAISE EXCEPTION 'rate_limit_exceeded: % attempts in last %s', v_count, p_window_seconds
      USING ERRCODE = 'P0001',
            HINT = 'Aguarde alguns segundos antes de tentar novamente.';
  END IF;

  -- Registra a chamada atual. Garbage collection: linhas com mais de 24h
  -- são deletadas em batch (próxima migration / cron). Por ora o índice
  -- mantém leituras rápidas mesmo com histórico.
  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (v_user_id, p_action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)
  TO authenticated;

-- ── 3. Plug em create_order ──────────────────────────────────────────────────
-- A função `create_order` existente precisa chamar `check_rate_limit` no
-- INÍCIO, antes de qualquer trabalho pesado. Como create_order é grande
-- e variável, NÃO reescrevemos aqui — fica como nota de implementação:
--
-- Dentro de create_order, logo após `BEGIN`, adicionar:
--
--   PERFORM public.check_rate_limit('create_order', 5, 60);
--
-- Isso aborta a transação com SQLSTATE P0001 se o limite for atingido,
-- e o frontend pega via `error.message` (já tratado em Checkout.tsx).

-- ── 4. Cleanup garbage collection (opcional, idempotente) ────────────────────
-- Roda apenas 1x no apply da migration — remove eventos antigos demais
-- pra serem relevantes a qualquer janela de rate-limit razoável.
DELETE FROM public.rate_limit_events
WHERE created_at < NOW() - INTERVAL '7 days';
