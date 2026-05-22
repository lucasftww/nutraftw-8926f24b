import { ShieldCheck, Truck, MessageCircle, Sparkles, QrCode, Lock } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Hero compacto no topo do Catalog — proposta de valor + trust signals.
 * Slim (~180px no mobile) — apresenta a Royal Vitta antes do scroll do catálogo
 * sem empurrar produtos pra fora da fold.
 *
 * Melhorias de conversão:
 *  - Urgência visual: badge "PIX 5% OFF"
 *  - Trust signals com ícone check
 *  - CTA de WhatsApp inline (suporte pré-compra é o canal #1 de conversão em
 *    farma de ticket alto)
 *  - Não usa emojis — viriam quebrados em Chromium/Windows. Ícones Lucide SVG.
 */
export function HomeHero() {
  return (
    <section className="container mx-auto px-4 pt-4 md:pt-6 animate-in fade-in duration-500">
      <div className="relative rounded-card md:rounded-hero border border-border/60 bg-gradient-to-br from-primary/[0.05] via-background to-secondary/[0.04] p-5 md:p-7 overflow-hidden">
        {/* Glows decorativos */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-brand opacity-[0.08] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-brand-cyan/20 blur-3xl"
        />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-eyebrow text-secondary-text mb-2.5">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Royal Vitta — Importação Farmacêutica
            </p>

            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-[1.15] max-w-xl">
              Farmacêuticos importados com{" "}
              <span className="bg-gradient-brand bg-clip-text text-transparent">
                procedência garantida
              </span>
            </h1>

            <p className="mt-2 text-sm-plus sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              Curadoria séria, frete rastreado para todo o Brasil e atendimento
              humano — sem intermediário, sem mistério no preço.
            </p>

            {/* Trust signals — 3 mais importantes para este nicho */}
            <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm-plus">
              <li className="inline-flex items-center gap-1.5 text-foreground/80">
                <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="font-semibold">100% original</span>
              </li>
              <li className="inline-flex items-center gap-1.5 text-foreground/80">
                <Truck className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="font-semibold">Envio nacional</span>
              </li>
              <li className="inline-flex items-center gap-1.5 text-foreground/80">
                <Lock className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="font-semibold">Pagamento seguro</span>
              </li>
              <li className="inline-flex items-center gap-1.5 text-foreground/80">
                <MessageCircle className="h-3.5 w-3.5 text-whatsapp shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="font-semibold">Suporte WhatsApp</span>
              </li>
            </ul>
          </div>

          {/* Badges de oferta — lado direito no desktop, abaixo no mobile */}
          <div className="flex sm:flex-col gap-2 sm:gap-2 sm:items-end shrink-0 flex-wrap">
            {/* Badge PIX */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 border border-secondary/25 px-3 py-1.5">
              <QrCode className="h-3.5 w-3.5 text-secondary-text shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="text-2xs font-bold text-secondary-text whitespace-nowrap">PIX 5% OFF</span>
            </div>
            {/* Badge parcelamento */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/60 px-3 py-1.5">
              <span className="text-2xs font-bold text-muted-foreground whitespace-nowrap">3× sem juros</span>
            </div>
            {/* Link WhatsApp — suporte pré-compra é a maior alavanca de
                conversão em farma de ticket alto. Aparece só no desktop
                para não competir com o FAB mobile. */}
            <Link
              to="/sobre"
              className="hidden sm:inline-flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              Saiba mais sobre nós →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
