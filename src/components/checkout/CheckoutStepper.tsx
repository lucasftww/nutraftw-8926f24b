import { memo } from "react";
import { Check } from "lucide-react";

/**
 * Stepper extraído + memoizado. Antes era um IIFE inline dentro de
 * Checkout.tsx que reconstruía o array `steps` a cada keystroke do form
 * (re-render do pai). Agora só re-renderiza quando uma das 3 flags muda.
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

  return (
    <ol className="mb-5 sm:mb-6 flex items-center gap-1.5 sm:gap-3" aria-label="Progresso do checkout">
      {steps.map((s, i) => {
        const isActive = s.n === activeN;
        return (
          <li
            key={s.n}
            className={`flex items-center gap-1.5 sm:gap-3 min-w-0 ${isActive ? "flex-1" : "shrink-0"} sm:flex-1`}
            aria-current={isActive ? "step" : undefined}
            aria-label={`Passo ${s.n} de ${steps.length}: ${s.label}${s.done ? " — concluído" : isActive ? " — atual" : ""}`}
          >
            <div
              className={`flex items-center gap-2 min-w-0 flex-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full border transition-colors ${
                s.done
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold shrink-0 ${
                  s.done ? "bg-success text-success-foreground" : "bg-background border border-border text-foreground"
                }`}
                aria-hidden
              >
                {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n}
              </span>
              <span className={`text-[11px] sm:text-xs font-semibold truncate ${isActive ? "inline" : "hidden"} sm:inline`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden className={`hidden sm:block h-px flex-1 ${s.done ? "bg-success/40" : "bg-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const CheckoutStepper = memo(StepperImpl);