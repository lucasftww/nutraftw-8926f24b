import { useEffect, useState } from "react";
import { Gift, X, Check, Copy } from "lucide-react";

/**
 * Popup discreto de cupom de boas-vindas — aparece UMA VEZ por visitante,
 * 8 segundos após o load (engaja sem incomodar imediatamente).
 *
 * Vantagens sobre a barra fixa no header:
 *  - Não rouba área permanente do viewport
 *  - Captura atenção quando aparece (animação slide-up)
 *  - Dismissível sem culpa (X grande)
 *  - Persiste o dismissal no localStorage
 *
 * Posicionamento:
 *  - Mobile: bottom-sheet acima da sticky CTA (não cobre)
 *  - Desktop: canto inferior direito, flutuando
 */

const STORAGE_KEY = "rv:welcome:popup:v2";
const COUPON = "BEMVINDO10";
const SHOW_DELAY_MS = 8_000;

export function WelcomeCouponPopup() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch { /* SSR/private mode: seguir */ }
    const t = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
      setCopied(true);
      window.setTimeout(dismiss, 1500);
    } catch {
      // fallback: ainda fecha, cliente copia manualmente
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="welcome-coupon-title"
      // Posicionamento responsivo:
      // - Mobile: fixo no canto inferior, largura quase total, acima da safe-area
      // - Desktop: flutua no canto inferior direito, largura fixa
      className="fixed z-40 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px] animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="relative rounded-2xl bg-card shadow-2xl border border-border/60 overflow-hidden">
        {/* Faixa decorativa superior com gradient da marca */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" aria-hidden />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar oferta de boas-vindas"
          className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
              <Gift className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p id="welcome-coupon-title" className="font-bold text-[15px] text-foreground leading-tight">
                Sua 1ª compra tem 10% OFF
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                Use o cupom no checkout para resgatar
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 inline-flex items-center justify-center h-11 rounded-xl border-2 border-dashed border-secondary/40 bg-secondary/5 px-3 font-mono font-extrabold tracking-[0.18em] text-secondary text-base">
              {COUPON}
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Cupom copiado" : "Copiar cupom"}
              className={`shrink-0 inline-flex items-center justify-center h-11 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                copied
                  ? "bg-success text-success-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
              }`}
            >
              {copied ? (
                <><Check className="h-4 w-4 mr-1.5" /> Pronto</>
              ) : (
                <><Copy className="h-4 w-4 mr-1.5" /> Copiar</>
              )}
            </button>
          </div>

          <p className="mt-3 text-[10.5px] text-muted-foreground/80 leading-tight">
            Cupom válido na 1ª compra · não acumula com outras promoções
          </p>
        </div>
      </div>
    </div>
  );
}
