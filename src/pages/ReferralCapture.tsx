import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { setAffiliateRef } from "@/lib/affiliateRef";

/**
 * /r/:code — registra a indicação no localStorage e redireciona para o catálogo.
 * Quando o usuário criar conta, o código é gravado em profiles.referred_by_code.
 *
 * Importante: o redirect SÓ acontece depois de garantir que o código foi
 * persistido. Renderizar <Navigate> direto no primeiro render desmonta o
 * componente antes do useEffect executar em alguns cenários (StrictMode +
 * navegação síncrona), o que faria perder a atribuição.
 */
export default function ReferralCapture() {
  const { code } = useParams<{ code: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setAffiliateRef(code ?? null);
    setReady(true);
  }, [code]);
  if (!ready) return null;
  return <Navigate to="/" replace />;
}