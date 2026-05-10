import { Check, QrCode, CreditCard, AlertCircle } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { PaymentOption } from "./PaymentOption";
import type { CheckoutFormState } from "./types";

const PIX_DISCOUNT = 0.05;

interface PaymentSectionProps {
  form: CheckoutFormState;
  setForm: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
  baseTotal: number;
  pixEnabled: boolean;
  cardEnabled: boolean;
}

export function PaymentSection({ form, setForm, baseTotal, pixEnabled, cardEnabled }: PaymentSectionProps) {
  const noneOn = !pixEnabled && !cardEnabled;
  const pixTotal = baseTotal * (1 - PIX_DISCOUNT);
  const cardTotal = baseTotal;
  const pixSaves = baseTotal - pixTotal;

  const onSelectMethod = (v: "pix" | "credit_card") =>
    setForm((f) => ({ ...f, payment_method: v }));

  return (
    <section className="checkout-card" data-checkout-payment>
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-extrabold tabular-nums shrink-0">4</span>
        <h2 className="checkout-section-title !mb-0">Pagamento</h2>
      </div>
      {noneOn ? (
        <div role="alert" className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-destructive text-sm">Pagamentos indisponíveis</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              Nenhum método está habilitado no momento. Fale com o suporte para finalizar.
            </p>
          </div>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {pixEnabled && (
            <PaymentOption
              value="pix"
              active={form.payment_method === "pix"}
              onSelect={onSelectMethod}
              title="PIX"
              subtitle="Liberação na hora · 5% off"
              icon={QrCode}
              badge={pixSaves > 0 ? { text: `Economize ${formatBRL(pixSaves)}`, tone: "secondary" } : { text: "Economize 5%", tone: "secondary" }}
              totalLabel="Total no PIX"
              totalValue={pixTotal}
            />
          )}
          {cardEnabled && (
            <PaymentOption
              value="credit_card"
              active={form.payment_method === "credit_card"}
              onSelect={onSelectMethod}
              title="Cartão de crédito"
              subtitle="Em até 3x sem juros"
              icon={CreditCard}
              totalLabel="Total no cartão"
              totalValue={cardTotal}
            />
          )}
        </div>
      )}
      {/* Dica de economia — só aparece se PIX disponível e não for o selecionado */}
      {pixEnabled && form.payment_method !== "pix" && baseTotal > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-success font-semibold">
          <Check className="w-3.5 h-3.5" />
          Pague no PIX e economize {formatBRL(baseTotal * PIX_DISCOUNT)}
        </p>
      )}
    </section>
  );
}
