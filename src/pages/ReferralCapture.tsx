import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { setAffiliateRef } from "@/lib/affiliateRef";

/**
 * /r/:code — registra a indicação no localStorage e redireciona para o catálogo.
 * Quando o usuário criar conta, o código é gravado em profiles.referred_by_code.
 */
export default function ReferralCapture() {
  const { code } = useParams<{ code: string }>();
  useEffect(() => {
    setAffiliateRef(code ?? null);
  }, [code]);
  return <Navigate to="/" replace />;
}