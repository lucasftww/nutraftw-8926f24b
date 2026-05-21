import { Loader2, Truck, Check } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { CheckoutFormState } from "./types";

interface ShippingOption {
  id: string;
  label: string;
  price: number | string;
  delivery_days_min?: number;
  delivery_days_max?: number;
}

interface ShippingSectionProps {
  form: CheckoutFormState;
  shippingOptions: ShippingOption[];
  shippingId: string | null;
  shippingLoading: boolean;
  insuranceOn: boolean;
  setShippingId: (id: string) => void;
  setInsuranceOn: (on: boolean) => void;
  insuranceOptional: string | undefined;
}

export function ShippingSection({
  form,
  shippingOptions,
  shippingId,
  shippingLoading,
  insuranceOn,
  setShippingId,
  setInsuranceOn,
  insuranceOptional,
}: ShippingSectionProps) {
  return (
    <section className="checkout-card space-y-5" data-checkout-shipping>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-extrabold tabular-nums shrink-0">3</span>
          <h2 className="checkout-section-title !mb-0">Entrega</h2>
        </div>
        {shippingLoading && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-2xs font-medium text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            atualizando…
          </span>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-3 block">Tipo de Frete</label>
        {shippingLoading && shippingOptions.length === 0 ? (
          <ul className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Calculando opções de frete">
            {[0, 1].map((i) => (
              <li key={i} className="p-4 rounded-xl border-2 border-border flex items-center gap-4">
                <div className="w-5 h-5 rounded-full skeleton-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded skeleton-shimmer" />
                  <div className="h-2.5 w-1/4 rounded skeleton-shimmer" />
                </div>
                <div className="h-3 w-16 rounded skeleton-shimmer" />
              </li>
            ))}
          </ul>
        ) : shippingOptions.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground">
            {form.state.length === 2
              ? "Sem opções de frete para este estado. Fale com o suporte."
              : "Selecione o estado para ver as opções de frete."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {shippingOptions.map((o) => {
              const active = shippingId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setShippingId(o.id)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-4 text-left ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? "border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {active && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      {o.label}
                    </p>
                    {o.delivery_days_min && o.delivery_days_max && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {o.delivery_days_min} a {o.delivery_days_max} dias úteis
                      </p>
                    )}
                    <p className="font-semibold text-primary mt-2">
                      {Number(o.price) === 0 ? "Grátis" : formatBRL(Number(o.price))}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {insuranceOptional !== "0" && (
        <div className="pt-4 border-t border-border">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center shrink-0">
              <input
                type="checkbox"
                checked={insuranceOn}
                onChange={(e) => setInsuranceOn(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-5 h-5 rounded-md border-2 transition-colors flex items-center justify-center ${
                  insuranceOn ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary"
                }`}
              >
                {insuranceOn && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
              </div>
            </div>
            <span className="text-sm text-foreground/90">
              Adicionar proteção de envio <span className="text-muted-foreground">(+10%)</span>
            </span>
          </label>
          {!insuranceOn && (
            <p className="mt-2 ml-8 text-2xs leading-snug text-muted-foreground">
              Pedidos sem seguro são de responsabilidade do comprador. Não nos responsabilizamos por problemas no transporte.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
