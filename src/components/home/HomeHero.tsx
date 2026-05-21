import { ShieldCheck, Truck, MessageCircle, Sparkles } from "lucide-react";

/**
 * Hero compacto no topo do Catalog — proposta de valor + trust signals.
 * Slim (~140px no mobile) — apresenta a Royal Vitta antes do scroll do catálogo
 * sem empurrar produtos pra fora da fold.
 *
 * Não usa emojis — viriam quebrados em Chromium/Windows. Ícones Lucide SVG.
 */
export function HomeHero() {
  return (
    <section className="container mx-auto px-4 pt-4 md:pt-6 animate-in fade-in duration-500">
      <div className="relative rounded-card md:rounded-hero border border-border/60 bg-gradient-to-br from-primary/[0.05] via-background to-secondary/[0.04] p-5 md:p-7 overflow-hidden">
        {/* Glow decorativo — profundidade sem custo de performance */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-brand opacity-10 blur-3xl"
        />

        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-eyebrow text-secondary-text mb-2.5">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Royal Vitta
          </p>

          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-[1.15] max-w-xl">
            Farmacêuticos importados com{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              procedência garantida
            </span>
          </h1>

          <p className="mt-2 text-sm-plus sm:text-sm text-muted-foreground leading-relaxed max-w-md">
            Curadoria séria, envio para todo o Brasil e atendimento humano via
            WhatsApp — sem mistério no preço.
          </p>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm-plus">
            <li className="inline-flex items-center gap-1.5 text-foreground/80">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="font-semibold">Produto 100% original</span>
            </li>
            <li className="inline-flex items-center gap-1.5 text-foreground/80">
              <Truck className="h-4 w-4 text-primary shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="font-semibold">Envio nacional</span>
            </li>
            <li className="inline-flex items-center gap-1.5 text-foreground/80">
              <MessageCircle className="h-4 w-4 text-whatsapp shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="font-semibold">Suporte WhatsApp</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
