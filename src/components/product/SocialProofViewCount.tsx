import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Badge "X pessoas viram nas últimas 24h" — prova social.
 *
 * Estratégia anti-vergonha:
 *  - Só renderiza se count >= MIN_THRESHOLD (5). Mostrar "1 pessoa viu"
 *    teria efeito INVERSO ao desejado.
 *  - Falha silenciosa: se a RPC não existir/falhar, simplesmente não
 *    renderiza nada (graceful degradation).
 *
 * Vem de uma RPC SECURITY DEFINER (`product_view_count_24h`) — public.
 * Não dá SELECT direto em product_events porque essa tabela é admin-only
 * por RLS.
 *
 * Conta DISTINCT session_id (pessoas, não pageviews).
 */
const MIN_THRESHOLD = 5;

export function SocialProofViewCount({ productId }: { productId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          "product_view_count_24h",
          { p_product_id: productId },
        );
        if (cancelled || error) return;
        const n = Number(data);
        if (Number.isFinite(n) && n >= MIN_THRESHOLD) {
          setCount(n);
        }
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  if (count == null) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-2xs sm:text-xs font-semibold animate-in fade-in duration-300"
      aria-live="polite"
    >
      <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span>
        <span className="tabular-nums font-extrabold">{count}</span>{" "}
        {count === 1 ? "pessoa viu" : "pessoas viram"}{" "}
        <span className="text-primary/70">nas últimas 24h</span>
      </span>
    </div>
  );
}
