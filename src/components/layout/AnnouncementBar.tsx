import { useEffect, useMemo, useState } from "react";
import { Truck, Wallet, ShieldCheck } from "lucide-react";
import { useFreeShippingMin } from "@/hooks/useFreeShippingMin";
import { formatBRL } from "@/lib/utils";

/**
 * Barra slim acima do header — gatilhos de conversão visíveis "ao vivo":
 * frete grátis, desconto PIX, garantia de origem. Mensagens rotacionam
 * a cada 5s com indicadores discretos (dots).
 *
 * ⚠️ NÃO é dismissível: em ticket alto (R$ 200-2000), perder o gatilho de
 * "frete grátis acima de R$ X" porque o usuário fechou uma vez na vida
 * é queima de conversão recorrente. A barra é slim (32px) e não invade
 * a UX.
 *
 * IMPORTANTE: usa ÍCONES Lucide (não emojis) — bandeira 🇧🇷 (compound
 * emoji) não renderiza em Chromium/Windows, virando "BR". Ícones SVG
 * são 100% confiáveis cross-platform.
 */

// "BEMVINDO10" foi movido para o WelcomeCouponPopup (popup discreto, 1x
// por visitante) — assim não compete pelo airtime com frete/PIX/origem.
const ROTATE_MS = 5000;

export function AnnouncementBar() {
  const [idx, setIdx] = useState(0);
  const freeShippingMin = useFreeShippingMin();

  // Mensagens montadas dinamicamente para refletir o threshold do admin
  // — antes "R$ 800" estava hardcoded e dessincronizava com a barra do carrinho.
  const messages = useMemo(
    () => [
      { text: `Frete GRÁTIS acima de ${formatBRL(freeShippingMin)}`, icon: Truck },
      { text: "5% OFF no PIX em todos os produtos", icon: Wallet },
      { text: "Produtos originais com garantia de procedência", icon: ShieldCheck },
    ],
    [freeShippingMin],
  );

  // Rotação automática das mensagens. Pausa quando aba perde foco para
  // não estourar setInterval em background.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIdx((i) => (i + 1) % messages.length);
      }
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [messages.length]);

  const Current = messages[idx];
  const Icon = Current.icon;

  return (
    <div
      // Bg gradient da MARCA (navy → cyan da logo) substitui bg-primary flat.
      // Cria identidade visual logo no topo e dá sensação premium sem custo.
      className="relative bg-gradient-brand text-white"
      role="region"
      aria-label="Avisos da loja"
    >
      <div className="mx-auto flex h-8 md:h-9 max-w-[1400px] items-center justify-center gap-2 px-4 text-center">
        <p
          key={idx}
          className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium tracking-tight truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
          aria-live="polite"
          aria-atomic="true"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="truncate">{Current.text}</span>
        </p>
      </div>
      {/* Indicadores discretos — confirma que há rotação e permite previsão.
          Em mobile (<sm) escondemos os dots para preservar verticalidade. */}
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1"
        aria-hidden="true"
      >
        {messages.map((_, i) => (
          <span
            key={i}
            className={`h-1 w-1 rounded-full transition-all duration-300 ${
              i === idx
                ? "bg-primary-foreground w-3"
                : "bg-primary-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
