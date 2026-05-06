-- Refunds estruturados: tabela própria registrando estornos com motivo categorizado
CREATE TYPE public.refund_reason AS ENUM (
  'customer_request',
  'product_unavailable',
  'shipping_issue',
  'payment_issue',
  'fraud',
  'duplicate_order',
  'other'
);

CREATE TYPE public.refund_status AS ENUM ('pending','processed','failed');

CREATE TABLE public.order_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason public.refund_reason NOT NULL DEFAULT 'other',
  notes TEXT,
  status public.refund_status NOT NULL DEFAULT 'pending',
  created_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_refunds_order ON public.order_refunds(order_id);
CREATE INDEX idx_order_refunds_status ON public.order_refunds(status);
CREATE INDEX idx_order_refunds_created ON public.order_refunds(created_at DESC);

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage refunds"
ON public.order_refunds
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own refunds"
ON public.order_refunds
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_refunds.order_id AND o.user_id = auth.uid()
));

CREATE TRIGGER update_order_refunds_updated_at
BEFORE UPDATE ON public.order_refunds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();