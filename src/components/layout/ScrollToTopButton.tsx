import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Botão flutuante "voltar ao topo" — aparece após scrollar 600px, fica
 * acima do botão de WhatsApp (canto inferior direito) sem cobri-lo.
 *
 * UX:
 *  - Aparece com fade-in suave
 *  - Click rola até o topo com behavior: smooth
 *  - Esconde de novo quando próximo do topo
 *  - Bottom espaça da safe-area iOS automaticamente
 *
 * Performance: usa passive listener + rAF para evitar trash de scroll.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;
    let lastY = window.scrollY;

    const onScroll = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const y = window.scrollY;
        // Histerese: aparece em >600px, desaparece em <400px (evita flicker)
        if (y > 600 && !visible) setVisible(true);
        else if (y < 400 && visible) setVisible(false);
        lastY = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Voltar ao topo"
      // Posiciona ACIMA do FloatingWhatsApp (que fica bottom-4/6).
      // bottom calculado para deixar gap visual entre os dois FABs.
      className="fixed right-4 sm:right-6 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border shadow-lg text-primary hover:bg-primary hover:text-primary-foreground active:scale-90 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}
