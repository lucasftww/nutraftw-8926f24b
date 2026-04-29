
-- 1. Função para gerar código de afiliado único (8 chars hex maiúsculo)
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE affiliate_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 2. Adicionar colunas ao profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS facebook_pixel text,
  ADD COLUMN IF NOT EXISTS referred_by_code text;

-- 3. Backfill de affiliate_code para perfis existentes
UPDATE public.profiles
   SET affiliate_code = public.generate_affiliate_code()
 WHERE affiliate_code IS NULL;

-- 4. Trigger para gerar código automático em novos perfis
CREATE OR REPLACE FUNCTION public.set_affiliate_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.affiliate_code IS NULL OR NEW.affiliate_code = '' THEN
    NEW.affiliate_code := public.generate_affiliate_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_affiliate_code ON public.profiles;
CREATE TRIGGER profiles_set_affiliate_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_code();

-- 5. Tabela de indicações (quem indicou quem)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_ref_affiliate ON public.affiliate_referrals(affiliate_user_id);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliate sees own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (auth.uid() = affiliate_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages referrals"
  ON public.affiliate_referrals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_aff_ref_updated_at
BEFORE UPDATE ON public.affiliate_referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Tabela de comissões
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','released','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_comm_affiliate ON public.affiliate_commissions(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_aff_comm_status ON public.affiliate_commissions(status);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliate sees own commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (auth.uid() = affiliate_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages commissions"
  ON public.affiliate_commissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_aff_comm_updated_at
BEFORE UPDATE ON public.affiliate_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
