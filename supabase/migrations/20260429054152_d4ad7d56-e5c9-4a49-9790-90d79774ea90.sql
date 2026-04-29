
-- Tabela de auditoria de ações administrativas
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,                -- create | update | delete | settings_save | status_change
  entity text NOT NULL,                -- products | categories | coupons | shipping_rates | site_banners | site_settings | orders | resends
  entity_id text,                      -- id (uuid em texto) ou key (settings)
  summary text,                        -- texto curto humano: "Cupom BEMVINDO10 (10%)"
  diff jsonb,                          -- { before: {...}, after: {...} } ou payload
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_entity ON public.admin_audit_log (entity, created_at DESC);
CREATE INDEX idx_admin_audit_user ON public.admin_audit_log (user_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins veem o log
CREATE POLICY "Admins view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins inserem (e o user_id deve ser o próprio)
CREATE POLICY "Admins insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND user_id = auth.uid()
  );

-- Ninguém edita ou apaga (auditoria é imutável). Sem policies UPDATE/DELETE.
