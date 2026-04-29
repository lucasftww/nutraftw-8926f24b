ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS referrer text;

CREATE INDEX IF NOT EXISTS affiliate_referrals_utm_source_idx
  ON public.affiliate_referrals(utm_source);
CREATE INDEX IF NOT EXISTS affiliate_referrals_utm_campaign_idx
  ON public.affiliate_referrals(utm_campaign);