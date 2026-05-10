import { useRef, forwardRef } from "react";
import { ShoppingBag, ChevronDown, Loader2, Lock, Check, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { CouponField } from "./CouponField";
import type { CheckoutFormState } from "./types";

interface OrderSummaryProps {
  form: CheckoutFormState;
  total: number;
  totalQty: number;
  summaryItems: React.ReactNode;
  itemsOpen: boolean;
  setItemsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shippingValue: number;
  shippingKnown: boolean;
  shippingLoading: boolean;
  insurance: number;
  couponDiscount: number;
  pixDiscount: number;
  grandTotal: number;
  baseTotal: number;
  coupon: any | null;
  couponInput: string;
  couponLoading: boolean;
  couponError: string | null;
  couponOpen: boolean;
  setCouponInput: (v: string) => void;
  setCouponOpen: (v: boolean) => void;
  setCoupon: (v: any | null) => void;
  setCouponError: (v: string | null) => void;
  applyCoupon: () => void;
  submitting: boolean;
  summaryCtaRef: React.RefObject<HTMLButtonElement>;
}

export function OrderSummary({
  form,
  total,
  totalQty,
  summaryItems,
  itemsOpen,
  setItemsOpen,
  shippingValue,
  shippingKnown,
  shippingLoading,
  insurance,
  couponDiscount,
  pixDiscount,
  grandTotal,
  baseTotal: _baseTotal,
  coupon,
  couponInput,
  couponLoading,
  couponError,
  couponOpen,
  setCouponInput,
  setCouponOpen,
  setCoupon,
  setCouponError,
  applyCoupon,
  submitting,
  summaryCtaRef,
}: OrderSummaryProps) {
  return (
    <aside className="bg-card p-4 sm:p-6 rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 h-fit md:sticky md:top-28">
      {/* Cabeçalho — colapsável no mobile, sempre aberto no desktop */}
      <button
        type="button"
        onClick={() => setItemsOpen((v) => !v)}
        aria-expanded={itemsOpen}
        aria-controls="checkout-summary-items"
        className="w-full flex items-center justify-between gap-3 lg:cursor-default lg:pointer-events-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingBag className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-base sm:text-xl font-bold tracking-tight">Resumo</h2>
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground tabular-nums">
            · {totalQty} {totalQty === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-foreground tabular-nums lg:hidden">{formatBRL(total)}</span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform lg:hidden ${itemsOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Lista de itens — colapsável no mobile */}
      <ul
        id="checkout-summary-items"
        className={`mt-3 sm:mt-4 mb-4 sm:mb-5 max-h-72 overflow-y-auto pr-1 divide-y divide-border/60 ${itemsOpen ? "block" : "hidden"} lg:block`}
      >
        {summaryItems}
      </ul>

      <div className="space-y-2.5 py-4 border-t border-border text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            Frete
            {shippingLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="Atualizando frete" />
            )}
          </span>
          <span className={`font-semibold tabular-nums transition-opacity ${shippingLoading ? "opacity-50" : ""}`}>
            {shippingKnown ? formatBRL(shippingValue) : <span className="text-muted-foreground font-normal">Informe o CEP</span>}
          </span>
        </div>
        {insurance > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seguro</span>
            <span className="font-semibold tabular-nums">{formatBRL(insurance)}</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div className="flex justify-between text-success font-semibold">
            <span className="truncate">Cupom {coupon?.code}</span>
            <span className="tabular-nums">−{formatBRL(couponDiscount)}</span>
          </div>
        )}
        {pixDiscount > 0 && (
          <div className="flex justify-between text-success font-semibold">
            <span>Desconto PIX</span>
            <span className="tabular-nums">−{formatBRL(pixDiscount)}</span>
          </div>
        )}
      </div>

      {/* Cupom */}
      <CouponField
        coupon={coupon}
        couponInput={couponInput}
        couponLoading={couponLoading}
        couponError={couponError}
        couponOpen={couponOpen}
        setCouponInput={setCouponInput}
        setCouponOpen={setCouponOpen}
        setCoupon={setCoupon}
        setCouponError={setCouponError}
        applyCoupon={applyCoupon}
      />

      {/* Total — compacto e centralizado no mobile */}
      <div className="mt-4 mb-4 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">Total</span>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground leading-none tabular-nums">
            {formatBRL(grandTotal)}
          </div>
          {form.payment_method === "credit_card" && grandTotal > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
              ou 3x de {formatBRL(grandTotal / 3)} sem juros
            </div>
          )}
          {form.payment_method === "pix" && (couponDiscount + pixDiscount) > 0 && (
            <div className="text-[11px] text-success font-semibold mt-1">
              Você economiza {formatBRL(couponDiscount + pixDiscount)}
            </div>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        ref={summaryCtaRef}
        className="inline-flex w-full h-12 sm:h-14 rounded-xl bg-success text-success-foreground font-bold text-base hover:bg-success/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all items-center justify-center gap-2 shadow-md shadow-success/25"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
        ) : (
          <><CheckCircle2 className="w-5 h-5" /> Finalizar pedido</>
        )}
      </button>
      {/* Reforços de confiança discretos abaixo do CTA */}
      <div className="mt-3 space-y-2">
        {form.payment_method === "pix" && (
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[11px] text-success font-semibold">
            <Check className="w-3 h-3" /> Pedido confirmado e enviado para atendimento
          </p>
        )}
        <div className="flex items-center justify-center gap-3 text-muted-foreground/70">
          <Lock className="w-3 h-3" aria-hidden />
          <span className="text-[10px] font-semibold tracking-wider uppercase">SSL</span>
          <span className="w-px h-3 bg-border" />
          <span className="text-[10px] font-bold tracking-wider">PIX</span>
          <span className="text-[10px] font-bold tracking-wider">VISA</span>
          <span className="text-[10px] font-bold tracking-wider">MASTER</span>
          <span className="text-[10px] font-bold tracking-wider">ELO</span>
        </div>
      </div>
    </aside>
  );
}
