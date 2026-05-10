-- Migration: security_hardening
-- Corrige 3 problemas de segurança identificados na auditoria:
--
-- 1. REVOKE INSERT/UPDATE/DELETE em site_settings do role authenticated
--    (o GRANT anterior era redundante com RLS — um bug futuro na policy
--     exposaria escrita para todos os usuários autenticados).
--
-- 2. Rate-limit por sessão em product_events: índice único parcial impede
--    que a mesma session_id insira mais de 1 evento do mesmo tipo para o
--    mesmo produto por hora — neutraliza spam de views artificiais.
--
-- 3. Trigger que auto-preenche user_email em admin_audit_log a partir de
--    auth.users — remove campo livre que podia ser adulterado pelo admin.

-- ── 1. site_settings: revogar grant desnecessário ────────────────────────────
-- RLS já protege a tabela (somente admins podem escrever).
-- O GRANT nível objeto era redundante e perigoso: se a policy de RLS fosse
-- removida/bugada, qualquer usuário autenticado poderia alterar configurações.
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM authenticated;

-- ── 2. product_events: rate-limit por sessão (1 evento/produto/tipo/hora) ────
-- Impede inflate de views por scripts. Usa índice parcial único truncando
-- created_at para hora — colisão = silently ignored no INSERT.
-- date_trunc('hour', timestamptz) é STABLE (depende do timezone), não IMMUTABLE.
-- Convertemos explicitamente para UTC antes de truncar: AT TIME ZONE 'UTC'
-- retorna um timestamp (sem fuso) que é IMMUTABLE — aceito pelo índice único.
CREATE UNIQUE INDEX IF NOT EXISTS product_events_session_rate_limit
  ON public.product_events (
    session_id,
    product_id,
    event_type,
    date_trunc('hour', created_at AT TIME ZONE 'UTC')
  )
  WHERE session_id IS NOT NULL;

-- RPC SECURITY DEFINER para inserção com ON CONFLICT DO NOTHING —
-- impede que o cliente direto veja o erro de unicidade (que vaza info sobre
-- outras sessões). O cliente continua usando INSERT via RPC, não direto.
CREATE OR REPLACE FUNCTION public.record_product_event(
  p_product_id  uuid,
  p_event_type  text,
  p_session_id  text DEFAULT NULL,
  p_user_id     uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_events (product_id, event_type, session_id, user_id)
  VALUES (p_product_id, p_event_type, p_session_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_event(uuid, text, text, uuid)
  TO anon, authenticated;

-- ── 3. admin_audit_log: trigger que força user_email correto ─────────────────
-- Antes, user_email era campo livre — admin podia registrar email falso.
-- Trigger BEFORE INSERT popula user_email com o email real do auth.users,
-- ignorando qualquer valor enviado pelo cliente.
CREATE OR REPLACE FUNCTION public.audit_log_set_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = NEW.user_id;

  NEW.user_email := COALESCE(v_email, NEW.user_email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_set_email ON public.admin_audit_log;
CREATE TRIGGER trg_audit_log_set_email
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_set_user_email();
