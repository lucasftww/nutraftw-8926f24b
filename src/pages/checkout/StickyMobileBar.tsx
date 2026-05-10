import { Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface StickyMobileBarProps {
  grandTotal: number;
  pixDiscount: number;
  submitting: boolean;
  buyerDone: boolean;
  addressDone: boolean;
  shippingDone: boolean;
  paymentSelected: boolean;
  form: { payment_method: "pix" | "credit_card" };
}

export function StickyMobileBar({
  grandTotal,
  pixDiscount,
  submitting,
  buyerDone,
  addressDone,
  shippingDone,
  paymentSelected,
  form,
}: StickyMobileBarProps) {
  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-2 duration-200"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 leading-tight">
          <span className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">Total</span>
          <span className="block text-lg font-extrabold text-foreground tabular-nums leading-tight mt-0.5">
            {formatBRL(grandTotal)}
          </span>
          {form.payment_method === "pix" && pixDiscount > 0 && (
            <span className="block text-[11px] text-success font-bold tabular-nums leading-none">
              PIX · economiza {formatBRL(pixDiscount)}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={submitting}
          aria-label={
            submitting
              ? "Processando pedido"
              : !buyerDone
                ? "Continuar — preencher seus dados"
                : !addressDone
                  ? "Continuar — preencher endereço"
                  : !shippingDone
                    ? "Continuar — escolher frete"
                      : !paymentSelected
                      ? "Continuar — escolher pagamento"
                      : "Finalizar pedido"
          }
          onClick={() => {
            // Foca a primeira seção incompleta para guiar o usuário.
            const target = !buyerDone
              ? document.querySelector<HTMLInputElement>('input[autocomplete="name"]')
              : !addressDone
              ? document.querySelector<HTMLInputElement>('input[autocomplete="postal-code"]')
              : !shippingDone
              ? document.querySelector<HTMLElement>('[data-checkout-shipping]')
              : !paymentSelected
              ? document.querySelector<HTMLElement>('[data-checkout-payment]') || document.querySelector<HTMLElement>('h2.checkout-section-title')
              : null;
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              if ((target as HTMLInputElement).focus) setTimeout(() => (target as HTMLInputElement).focus(), 350);
              return;
            }
            // Tudo pronto → submete o form.
            document.querySelector<HTMLFormElement>('form')?.requestSubmit();
          }}
          className="h-12 px-5 rounded-2xl text-sm font-extrabold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/30 whitespace-nowrap active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> Processando…</>
          ) : (buyerDone && addressDone && shippingDone && paymentSelected) ? (
            <>Finalizar pedido</>
          ) : (
            <>Continuar</>
          )}
        </button>
      </div>
    </div>
  );
}
