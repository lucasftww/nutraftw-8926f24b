import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { readAttributionFromUrl, setAffiliateRef } from "@/lib/affiliateRef";

/**
 * Captura `?ref=CODIGO` em QUALQUER rota e persiste o código (30 dias).
 * FIRST-TOUCH: se o usuário já tem um código salvo, novos `?ref=` apenas
 * renovam o TTL do código original (não sobrescrevem). Alinhado com o
 * trigger Postgres `protect_referred_by_code`.
 */
export function useCaptureAffiliateRef() {
  const { search } = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(search).get("ref");
    if (ref) setAffiliateRef(ref, readAttributionFromUrl(search));
  }, [search]);
}