import { Check, User as UserIcon, MapPin, Truck, CreditCard } from "lucide-react";

export type CheckoutStepKey = "buyer" | "address" | "shipping" | "payment";

const STEPS: { key: CheckoutStepKey; label: string; short: string; icon: typeof UserIcon }[] = [
  { key: "buyer", label: "Dados", short: "Dados", icon: UserIcon },
  { key: "address", label: "Endereço", short: "Endereço", icon: MapPin },
  { key: "shipping", label: "Frete", short: "Frete", icon: Truck },
  { key: "payment", label: "Pagamento", short: "Pagto", icon: CreditCard },
];

interface Props {
  /** índice 0..3 da etapa atualmente em foco/pendente */
  current: number;
  /** índice da última etapa concluída (-1 se nenhuma) */
  completed: number;
}

/**
 * Indicador de progresso do checkout (4 etapas).
 * - Mobile: chips compactos com barra contínua de progresso embaixo.
 * - Desktop: círculos com label e linha conectora.
 * Não controla navegação — é puramente visual; o form continua single-page.
 */
export function CheckoutSteps({ current, completed }: Props) {
  const total = STEPS.length;
  // Progresso = etapas concluídas + parcial da atual
  const pct = Math.min(
    100,
    Math.max(0, ((Math.max(completed, -1) + 1) / total) * 100 + (current > completed ? 100 / total / 2 : 0)),
  );

  return (
    <div className="mb-5 sm:mb-8">
      {/* Linha base + progresso (compartilhada mobile/desktop) */}
      <div className="relative">
        <ol className="grid grid-cols-4 gap-1 sm:gap-2 relative z-10">
          {STEPS.map((s, i) => {
            const done = i <= completed;
            const active = i === current && !done;
            const Icon = done ? Check : s.icon;
            return (
              <li key={s.key} className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
                <div
                  className={[
                    "relative flex items-center justify-center rounded-full transition-all duration-300",
                    "w-9 h-9 sm:w-11 sm:h-11 border-2 shrink-0",
                    done
                      ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                      : active
                        ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/15"
                        : "bg-background border-border text-muted-foreground",
                  ].join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  <Icon className={done ? "w-4 h-4 sm:w-5 sm:h-5" : "w-4 h-4 sm:w-5 sm:h-5"} strokeWidth={done ? 3 : 2} />
                  {active && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                  )}
                </div>
                <span
                  className={[
                    "text-[10px] sm:text-xs font-semibold leading-tight text-center truncate w-full",
                    done || active ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Barra de progresso contínua */}
      <div className="mt-3 sm:mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary-glow rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Etapa ${current + 1} de ${total}: ${STEPS[current]?.label ?? ""}`}
        />
      </div>

      <p className="mt-2 text-center text-[11px] sm:text-xs text-muted-foreground">
        Etapa <span className="font-bold text-foreground">{Math.min(current + 1, total)}</span> de {total} —{" "}
        <span className="font-semibold text-primary">{STEPS[current]?.label}</span>
      </p>
    </div>
  );
}