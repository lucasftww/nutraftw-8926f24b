import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Banner de boas-vindas com cupom BEMVINDO10 — substitui o que o usuário
 * lembra como "aviso vermelho no topo da home". A mensagem antiga ficava
 * só na rotação do AnnouncementBar (1/3 do airtime), perdendo conversão.
 *
 * Regras:
 *  - Aparece SOMENTE na primeira visita (localStorage flag).
 *  - Dismissível via "X" (não-volta).
 *  - Click no cupom copia para a área de transferência → toast confirma.
 *  - Persistência: `rv:welcome:dismissed=1` quando o usuário fechar ou
 *    o cupom for copiado (assumimos intenção de usar).
 *  - Não renderiza no checkout (Header já é desligado lá; replicamos a regra).
 *
 * Por que client-side: precisa de window/localStorage. Hydration-safe: só
 * renderiza após o primeiro useEffect, então não há mismatch SSR.
 */

const STORAGE_KEY = "rv:welcome:dismissed";
const COUPON = "BEMVINDO10";

export function FirstPurchaseBanner({ disabled = false }: { disabled?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch { /* SSR/privado: deixa renderizar */ }
    setVisible(true);
  }, [disabled]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
  };

  const copyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
      toast.success(`Cupom ${COUPON} copiado!`, {
        description: "Cole no checkout para ganhar 10% OFF na sua primeira compra.",
      });
      dismiss();
    } catch {
      // Fallback discreto: ainda dispensa, mostra o cupom em destaque
      toast.message(`Cupom: ${COUPON}`, {
        description: "Copie manualmente e cole no checkout.",
      });
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      // bg-destructive (vermelho) — comando do usuário: "aviso vermelho".
      // Borda inferior cria separação clara com o resto.
      className="relative bg-destructive text-destructive-foreground"
      role="region"
      aria-label="Cupom de boas-vindas"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-2 px-12 py-2 text-center sm:gap-3">
        <Gift className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <p className="text-[12px] sm:text-[13px] font-semibold leading-tight">
          <span className="hidden sm:inline">Primeira compra: </span>
          <button
            type="button"
            onClick={copyCoupon}
            className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 font-black tracking-wider hover:bg-white/30 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Copiar cupom BEMVINDO10"
          >
            {COUPON}
          </button>
          <span className="ml-1.5">— 10% OFF</span>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-destructive-foreground/80 hover:bg-white/15 hover:text-destructive-foreground transition-colors"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
