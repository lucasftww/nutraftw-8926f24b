import { ShieldCheck, Truck, MessageCircle, Sparkles } from "lucide-react";

/**
 * Hero compacto no topo do Catalog — proposta de valor + trust signals.
 *
 * Por que adicionar: antes o Catalog ia direto da search bar pros
 * produtos. Cliente novo entrava SEM contexto da marca ou diferenciais.
 * Esta seção slim (~140px no mobile) introduz Royal Vitta antes do
 * scroll do catálogo, sem empurrar produtos pra fora da fold.
 *
 * Não é full-bleed banner — fica DENTRO do container, espaço
 * proporcional, sem competir com a grade de produtos.
 *
 * Trust signals são 3 elementos curtos que comunicam: original +
 * envio + suporte humano. Cada um com ícone Lucide (cross-platform,
 * sem emoji 🇧🇷 que quebra no Chromium/Windows).
 */
export function HomeHero() {
  return (
    <section className="container mx-auto px-4 pt-4 md:pt-6 animate-in fade-in duration-500">
      <div className="relative rounded-2xl md:rounded-3xl border border-border/60 bg-gradient-to-br from-primary/[0.05] via-background to-secondary/[0.04] p-5 md:p-7 overflow-hidden">
        {/* Glow decorativo no canto — gradient da marca, blur grande, opacity baixa.
            Adiciona profundidade sem custar performance. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-brand opacity-10 blur-3xl"
        />

        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text mb-2.5">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Royal Vitta
          </p>

          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-[1.15] max-w-xl">
            Farmacêuticos importados com{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              procedência garantida
            </span>
          </h1>

          <p className="mt-2 text-[13px] sm:text-sm text-muted-foreground leading-relaxed max-w-md">
            Curadoria séria, envio para todo o Brasil e atendimento humano via
            WhatsApp — sem mistério no preço.
          </p>

          {/* Trust badges — 3 itens horizontais, scroll-x no mobile se necessário */}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] sm:text-[13px]">
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
