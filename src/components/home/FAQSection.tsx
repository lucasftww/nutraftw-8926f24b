import { ChevronDown, HelpCircle } from "lucide-react";

/**
 * FAQ na Home — perguntas mais comuns de pré-compra (importação,
 * prazo, autenticidade, receita médica). Cobre as objeções típicas
 * que travam conversão.
 *
 * Implementação: `<details>` nativo (zero JS, zero dependência,
 * acessível via teclado por default, anuncia open/closed). Mesma
 * abordagem do FAQ inline da ProductDetail — consistência visual e
 * comportamental entre as duas telas.
 *
 * Posicionamento na Home: depois dos produtos e ANTES dos
 * depoimentos. Sequência mental: vejo produto → tenho dúvida → FAQ
 * responde → outros já compraram (prova social) → comprar.
 */

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: "Os produtos são originais e seguros?",
    answer:
      "Sim. Trabalhamos exclusivamente com produtos originais, importados e armazenados conforme as recomendações do fabricante. Garantia de procedência em todas as compras — se não for original, devolvemos 100% do valor.",
  },
  {
    question: "Qual o prazo de entrega?",
    answer:
      "Entregamos para todo o Brasil. O prazo varia conforme sua região (geralmente 2 a 7 dias úteis após a confirmação do pagamento). Use a calculadora de frete na página do produto para ver o prazo exato da sua cidade.",
  },
  {
    question: "Quais formas de pagamento vocês aceitam?",
    answer:
      "PIX (com 5% de desconto à vista — preço-âncora) e cartão de crédito em até 3x sem juros. Pagamento processado com criptografia SSL/TLS ponta a ponta.",
  },
  {
    question: "Como acompanho meu pedido?",
    answer:
      "Após o pagamento, você recebe um link da página do pedido com timeline em tempo real (pagamento aprovado → preparação → enviado → entregue). Atualizações também por WhatsApp e e-mail.",
  },
  {
    question: "Posso tirar dúvidas antes de comprar?",
    answer:
      "Sim — e recomendamos. Nossa equipe atende via WhatsApp em horário comercial. Indicamos o produto certo para o seu caso, esclarecemos dúvidas técnicas e ajudamos a escolher a opção mais econômica.",
  },
  {
    question: "E se eu tiver problema com o produto recebido?",
    answer:
      "Entre em contato pelo WhatsApp imediatamente. Troca/devolução garantida em até 7 dias após o recebimento, conforme CDC (Código de Defesa do Consumidor).",
  },
];

export function FAQSection() {
  return (
    <section
      className="container mx-auto px-4 py-10 md:py-14"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary mb-3">
            <HelpCircle className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </div>
          <h2
            id="faq-heading"
            className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground"
          >
            Perguntas frequentes
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Não achou sua dúvida? Fale com a gente no WhatsApp — atendimento humano.
          </p>
        </div>

        <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card overflow-hidden">
          {FAQS.map((item, i) => (
            <details
              key={i}
              className="group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 cursor-pointer list-none hover:bg-muted/40 transition-colors">
                <span className="text-[14px] sm:text-[15px] font-semibold text-foreground pr-2">
                  {item.question}
                </span>
                <ChevronDown
                  className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </summary>
              <p className="px-4 sm:px-5 pb-4 -mt-1 text-[13px] sm:text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
