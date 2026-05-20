import { Star } from "lucide-react";

/**
 * Depoimentos sociais — bloco fixo de prova social no Catalog antes
 * do footer. Como não temos sistema de reviews ainda, usamos
 * depoimentos curados (representativos do feedback real recebido pelo
 * canal WhatsApp/email).
 *
 * IMPORTANTE: substituir os 3 depoimentos abaixo por feedbacks REAIS
 * de clientes antes do go-live. Falsificar prova social = violação de
 * código de defesa do consumidor + risco reputacional. Mantemos como
 * placeholder com nomes/cidades genéricos para que ninguém se sinta
 * representado erroneamente.
 *
 * Não tem carrossel — 3 cards estáticos, grid responsivo. Carrosséis
 * em mobile esbarram em conflito de gestos (scroll vertical vs
 * horizontal) e baixam engajamento.
 */

interface Testimonial {
  name: string;
  city: string;
  text: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Carlos M.",
    city: "São Paulo, SP",
    text: "Recebi meu pedido no prazo, produto original e bem embalado. Atendimento ágil no WhatsApp tirou todas as dúvidas antes da compra.",
    rating: 5,
  },
  {
    name: "Ana L.",
    city: "Rio de Janeiro, RJ",
    text: "Já é meu segundo pedido. Preço transparente, entrega rastreada e suporte humano de verdade — não bot. Recomendo.",
    rating: 5,
  },
  {
    name: "Roberto F.",
    city: "Belo Horizonte, MG",
    text: "Curadoria séria mesmo. Eles indicaram o produto certo pro meu caso pelo WhatsApp e veio direitinho como o site mostrou.",
    rating: 5,
  },
];

export function TestimonialsSection() {
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
        {TESTIMONIALS.map((t) => (
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
