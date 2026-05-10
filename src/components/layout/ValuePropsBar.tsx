import { Truck, Lock, BadgeCheck } from "lucide-react";

/**
 * Strip horizontal compacto com 3 propostas de valor sempre visíveis —
 * substitui o "trust gap" que existia entre o AnnouncementBar rotativo
 * (que pode estar mostrando outra coisa naquele momento) e a grade de
 * produtos.
 *
 * Princípios:
 *  - Não-scrollável (cabe em 360px de largura sem cortes).
 *  - Texto curto (≤2 palavras por linha).
 *  - Ícone outline 16px (não compete com o logo).
 *  - Border sutil top/bottom — separa do header sem peso visual.
 *
 * Para 25-50yo, ticket alto, esses 3 gatilhos resolvem ~80% das objeções
 * pré-compra: "é seguro?", "vai chegar?", "é original mesmo?".
 *
 * Aparece apenas na rota raiz (/) — em ProductDetail os mesmos selos já
 * aparecem em formato card 2x2 maior, e em Checkout/MyAccount não há
 * razão para sinalização redundante.
 */
export function ValuePropsBar() {
  return (
    <div className="border-b border-border/60 bg-card/40">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-3 gap-1 sm:gap-3 py-2 sm:py-2.5">
          <ValueProp
            icon={Truck}
            title="Frete grátis"
            subtitle="acima de R$ 800"
          />
          <ValueProp
            icon={BadgeCheck}
            title="100% Original"
            subtitle="procedência garantida"
          />
          <ValueProp
            icon={Lock}
            title="Compra segura"
            subtitle="pagamento criptografado"
          />
        </ul>
      </div>
    </div>
  );
}

function ValueProp({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Truck;
  title: string;
  subtitle: string;
}) {
  return (
    <li className="flex items-center justify-center sm:justify-start gap-2 min-w-0">
      <Icon
        className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 text-primary/80"
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 leading-tight text-center sm:text-left">
        <p className="text-[11px] sm:text-[12.5px] font-bold text-foreground leading-none">
          {title}
        </p>
        <p className="hidden sm:block text-[11px] text-muted-foreground leading-tight mt-0.5">
          {subtitle}
        </p>
      </div>
    </li>
  );
}
