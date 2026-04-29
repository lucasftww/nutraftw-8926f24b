CREATE OR REPLACE FUNCTION public.protect_referred_by_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin pode alterar livremente
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Se já existia um código e está mudando, mantém o original (first-touch wins)
  IF OLD.referred_by_code IS NOT NULL
     AND length(trim(OLD.referred_by_code)) > 0
     AND COALESCE(NEW.referred_by_code, '') <> COALESCE(OLD.referred_by_code, '') THEN
    NEW.referred_by_code := OLD.referred_by_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_referred_by_code ON public.profiles;
CREATE TRIGGER profiles_protect_referred_by_code
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_referred_by_code();