import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setAffiliateRef } from "@/lib/affiliateRef";

/**
 * Captura `?ref=CODIGO` em QUALQUER rota e persiste o código (30 dias).
 * Last-click wins: se o usuário chega por outro link de afiliado depois,
 * o código mais recente substitui o anterior.
 */
export function useCaptureAffiliateRef() {
  const { search } = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(search).get("ref");
    if (ref) setAffiliateRef(ref);
  }, [search]);
}