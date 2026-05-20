import { Star } from "lucide-react";

/**
 * Depoimentos sociais — bloco fixo de prova social no Catalog antes do
 * footer.
 *
 * IMPORTANTE: recebe os depoimentos via PROP (`items`). Não publica
 * placeholder em produção — testimoniais inventados violam o CDC
 * (publicidade enganosa, art. 37) e a LGPD (uso indevido de imagem/nome).
 *
 * Quando vazio (array sem itens), o componente **NÃO renderiza nada**.
 * Isso é intencional: melhor não mostrar prova social do que mostrar
 * uma falsa.
 *
 * Para ativar: passe a lista de depoimentos REAIS coletados (via
 * WhatsApp, email, Google Reviews, etc) ao chamar:
 *
 *   <TestimonialsSection items={meusDepoimentosReais} />
 *
 * Ou centralize em um Supabase table futura (`testimonials`) com
 * moderação admin.
 *
 * Não tem carrossel — 3+ cards estáticos, grid responsivo. Carrosséis
 * em mobile esbarram em conflito de gestos (scroll vertical vs
 * horizontal) e baixam engajamento.
 */

export interface Testimonial {
  name: string;
  city: string;
  text: string;
  /** 1-5 — quantas estrelas exibir como rating. */
  rating: number;
}

export function TestimonialsSection({ items }: { items: Testimonial[] }) {
  // Sem dados reais → não renderiza. Falar bem dos depoimentos que você
  // ainda não tem é pior do que ficar quieto.
  if (!items || items.length === 0) return null;

  return (
    <section
      className="container mx-auto px-4 py-10 md:py-14"
      aria-labelledby="testimonials-heading"
    >
      <div className="text-center mb-7 md:mb-9">
        <p className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text mb-2">
          Quem comprou recomenda
        </p>
        <h2
          id="testimonials-heading"
          className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground"
        >
          O que dizem nossos clientes
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {items.map((t) => (
          <article
            key={t.name + t.city}
            className="rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all flex flex-col"
          >
            <div
              className="flex gap-0.5 text-amber-400 mb-3"
              aria-label={`${t.rating} de 5 estrelas`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < t.rating ? "fill-current" : "opacity-30"}`}
                  strokeWidth={1.5}
                  aria-hidden
                />
              ))}
            </div>
            <blockquote className="text-[13px] md:text-sm text-foreground/85 leading-relaxed flex-1">
              &ldquo;{t.text}&rdquo;
            </blockquote>
            <footer className="mt-4 pt-3 border-t border-border/40">
              <p className="font-semibold text-[13px] text-foreground">{t.name}</p>
              <p className="text-[11.5px] text-muted-foreground">{t.city}</p>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
