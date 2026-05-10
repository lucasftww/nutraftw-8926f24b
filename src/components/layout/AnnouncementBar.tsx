import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Barra slim acima do header — gatilhos de conversão visíveis "ao vivo":
 * frete grátis, desconto PIX, cupom de boas-vindas. Mensagens rotacionam
 * a cada 6s. Persiste dispensa em localStorage para não fadigar retorno.
 *
 * Em ticket alto (peptídeos R$ 200-2000), esses gatilhos elevam AOV e
 * conversão mensurável (5-12% em estudos de e-commerce BR).
 */
const STORAGE_KEY = "rv-announcement-dismissed-v1";

const MESSAGES = [
  "Frete GRÁTIS acima de R$ 800",
  "💰 5% OFF no PIX em todos os produtos",
  "Use BEMVINDO10 e ganhe 10% na 1ª compra",
];

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [idx, setIdx] = useState(0);

  // Rotação automática das mensagens. Pausa quando aba perde foco para
  // não estourar setInterval em background.
  useEffect(() => {
    if (dismissed) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIdx((i) => (i + 1) % MESSAGES.length);
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, [dismissed]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }

  if (dismissed) return null;

  return (
    <div
      className="relative bg-primary text-primary-foreground"
      role="region"
      aria-label="Avisos da loja"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-center gap-2 px-12 text-center">
        <Sparkles className="h-3.5 w-3.5 opacity-80 shrink-0" aria-hidden />
        <p
          key={idx}
          className="text-[12px] sm:text-sm font-medium tracking-tight truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
        >
          {MESSAGES[idx]}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar aviso"
        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
      >
        <span aria-hidden className="text-base leading-none">×</span>
      </button>
    </div>
  );
}
