import { Check, Ticket } from "lucide-react";

interface CouponFieldProps {
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
}

export function CouponField({
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
}: CouponFieldProps) {
  return (
    <div className="border-t border-border pt-4 pb-4">
      {coupon ? (
        <>
          <div
            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              couponError ? "bg-destructive/10" : "bg-success/10"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              <Check className={`h-4 w-4 ${couponError ? "text-destructive" : "text-success"}`} />
              <span className="font-semibold">{coupon.code}</span>
              <span className="text-xs text-muted-foreground">
                {couponError ? "indisponível" : "aplicado"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCoupon(null);
                setCouponInput("");
                setCouponError(null);
                setCouponOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              remover
            </button>
          </div>
          {couponError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {couponError}
            </p>
          )}
        </>
      ) : !couponOpen ? (
        <button
          type="button"
          onClick={() => setCouponOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <Ticket className="w-4 h-4" /> Tem cupom?
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="checkout-input pl-9 uppercase tracking-wider"
                placeholder="Cupom de desconto"
                value={couponInput}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={32}
                onChange={(e) => {
                  // Normaliza no estado, não só no display: remove
                  // espaços (paste com espaço extra é comum) e força
                  // alfanumérico maiúsculo. Garante que o que o
                  // servidor recebe = o que o usuário vê.
                  const cleaned = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9_-]/g, "");
                  setCouponInput(cleaned);
                  if (couponError) setCouponError(null);
                }}
              />
            </div>
            <button
              type="button"
              disabled={couponLoading || !couponInput.trim()}
              onClick={applyCoupon}
              className="h-12 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:bg-primary-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {couponLoading ? "…" : "Aplicar"}
            </button>
          </div>
          {couponError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {couponError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
