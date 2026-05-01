-- Permite ao próprio usuário recém-cadastrado inserir o registro de indicação
-- onde ele aparece como referred_user_id. Não permite forjar outros campos críticos.
CREATE POLICY "User registers own referral on signup"
ON public.affiliate_referrals
FOR INSERT
TO authenticated
WITH CHECK (referred_user_id = auth.uid());
