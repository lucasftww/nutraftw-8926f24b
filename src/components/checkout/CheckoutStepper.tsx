import { memo } from "react";
import { Check } from "lucide-react";

/**
 * Stepper memoizado do checkout. Bolinhas numeradas equidistantes conectadas
 * por linha de progresso animada.
 */
export interface CheckoutStepperProps {
  buyerDone: boolean;
  addressDone: boolean;
  shippingDone: boolean;
  paymentDone: boolean;
}

function StepperImpl({ buyerDone, addressDone, shippingDone, paymentDone }: CheckoutStepperProps) {
  const steps = [
    { n: 1, label: "Seus dados", done: buyerDone },
    { n: 2, label: "Entrega", done: addressDone && shippingDone },
    { n: 3, label: "Pagamento", done: paymentDone },
  ];
  const activeIdx = steps.findIndex((s) => !s.done);
  const activeN = activeIdx === -1 ? steps.length : steps[activeIdx].n;
  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = (completedCount / (steps.length - 1)) * 100;

  return (
    <nav className="mb-6 sm:mb-8 px-2" aria-label="Progresso do checkout">
      <ol className="relative flex items-start justify-between">
        {/* Trilho de fundo — top-[18px] = metade da bolinha h-9 (36px / 2) */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[18px] h-[2px] bg-border rounded-full mx-[14%]"
        />
        <div
          aria-hidden
          className="absolute top-[18px] h-[2px] bg-primary rounded-full mx-[14%] transition-all duration-500 ease-out"
          style={{ left: 0, width: `calc((100% - 2 * 14%) * ${progressPct / 100})` }}
        />

        {steps.map((s) => {
          const isActive = s.n === activeN && !s.done;
          return (
            <li
              key={s.n}
              className="relative flex flex-col items-center gap-2 flex-1 min-w-0"
              aria-current={isActive ? "step" : undefined}
              aria-label={`Passo ${s.n} de ${steps.length}: ${s.label}${
                s.done ? " — concluído" : isActive ? " — atual" : ""
              }`}
            >
              <span
                className={[
                  "relative z-10 inline-flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold transition-all duration-300",
                  s.done
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : isActive
                      ? "bg-background text-primary border-2 border-primary ring-4 ring-primary/15"
                      : "bg-background text-muted-foreground border-2 border-border",
                ].join(" ")}
                aria-hidden
              >
                {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
              </span>
              <span
                className={[
                  "text-2xs sm:text-xs font-semibold text-center leading-tight transition-colors",
                  s.done || isActive ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const CheckoutStepper = memo(StepperImpl);
