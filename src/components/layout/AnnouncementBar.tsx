import { useEffect, useMemo, useState } from "react";
import { Truck, Wallet, ShieldCheck, X } from "lucide-react";
import { useFreeShippingMin } from "@/hooks/useFreeShippingMin";
import { formatBRL } from "@/lib/utils";

/**
 * Barra slim acima do header — gatilhos de conversão: frete grátis, PIX, garantia.
 * Mensagens rotacionam a cada 5s. Não dismissível por padrão (ver comentário abaixo).
 *
 * Usa ícones Lucide (não emojis) — emojis compostos (🇧🇷) não renderizam
 * em Chromium/Windows. Ícones SVG são 100% cross-platform.
 */
const ROTATE_MS = 5000;

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("announcebar-v1") === "closed",
  );
  const [idx, setIdx] = useState(0);
  const freeShippingMin = useFreeShippingMin();

  const messages = useMemo(
    () => [
      { text: `Frete GRÁTIS acima de ${formatBRL(freeShippingMin)}`, icon: Truck },
      { text: "5% OFF no PIX em todos os produtos", icon: Wallet },
      { text: "Produtos originais com garantia de procedência", icon: ShieldCheck },
    ],
    [freeShippingMin],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIdx((i) => (i + 1) % messages.length);
      }
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [messages.length]);

  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("announcebar-v1", "closed");
    setDismissed(true);
  };

  const Current = messages[idx];
  const Icon = Current.icon;

  return (
    <div
      className="relative bg-gradient-brand text-white"
      role="region"
      aria-label="Avisos da loja"
    >
      <div className="mx-auto flex h-8 md:h-9 max-w-[1400px] items-center justify-center gap-2 px-4 text-center">
        <p
          key={idx}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm-plus font-medium tracking-tight truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
          aria-live="polite"
          aria-atomic="true"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="truncate">{Current.text}</span>
        </p>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-1" aria-hidden="true">
          {messages.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === idx
                  ? "bg-primary-foreground w-3"
                  : "bg-primary-foreground/40 w-1"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors"
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
