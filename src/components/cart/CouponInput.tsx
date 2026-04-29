import { useEffect, useState } from "react";
import { Loader2, Ticket, Check, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Cupom já no carrinho — adianta o gatilho de desconto antes do checkout.
 * Persiste no cart-store, então o Checkout pré-carrega aplicado.
 */
export function CouponInput() {
  const { coupon, setCoupon, total } = useCart();
  const [code, setCode] = useState(coupon ?? "");
  const [open, setOpen] = useState(!!coupon);
  const [loading, setLoading] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [valid, setValid] = useState<boolean>(!!coupon);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    setCode(coupon ?? "");
    if (!coupon) { setValid(false); setDiscount(0); setWarning(null); }
  }, [coupon]);

  // Revalida sempre que o cupom muda OU o total muda (mín. subtotal)
  useEffect(() => {
    if (!coupon) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("coupons")
        .select("code, discount_type, discount_value, min_subtotal, expires_at, active, max_uses, uses")
        .eq("code", coupon)
        .maybeSingle();
      if (cancel) return;
      const c = data as any;
      const reason = explainInvalid(c, total);
      if (reason) {
        setValid(false); setDiscount(0); setWarning(reason); return;
      }
      const d = c.discount_type === "percent"
        ? Math.round(total * Number(c.discount_value) / 100 * 100) / 100
        : Math.min(Number(c.discount_value), total);
      setValid(true);
      setDiscount(d);
      setWarning(null);
    })();
    return () => { cancel = true; };
  }, [coupon, total]);

  function explainInvalid(c: any, subtotal: number): string | null {
    if (!c || !c.active) return "Cupom não encontrado ou desativado.";
    if (c.expires_at && new Date(c.expires_at) < new Date()) return "Este cupom expirou.";
    if (c.max_uses != null && c.uses >= c.max_uses) return "Este cupom atingiu o limite de usos.";
    const min = Number(c.min_subtotal || 0);
    if (min > 0 && subtotal < min) {
      return `Mínimo de ${formatBRL(min)} para usar este cupom (faltam ${formatBRL(min - subtotal)}).`;
    }
    return null;
  }

  async function apply() {
    const v = code.trim().toUpperCase();
    if (!v) { setError("Digite um código."); return; }
    setLoading(true);
    setError(null);
    const { data } = await (supabase as any)
      .from("coupons")
      .select("code, discount_type, discount_value, min_subtotal, expires_at, active, max_uses, uses")
      .eq("code", v)
      .maybeSingle();
    setLoading(false);
    const reason = explainInvalid(data, total);
    if (reason) {
      setError(reason);
      return;
    }
    setCoupon(v);
    toast.success("Cupom aplicado!", { description: "Desconto atualizado no seu carrinho." });
  }

  function remove() {
    setCoupon(null);
    setCode("");
    setValid(false);
    setDiscount(0);
    setWarning(null);
    setError(null);
  }

  if (!open && !coupon) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border text-xs font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors animate-fade-in"
      >
        <Ticket className="h-3.5 w-3.5" />
        Tem cupom de desconto?
      </button>
    );
  }

  if (coupon && valid) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/30 animate-scale-in">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 text-success shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-success leading-tight truncate">{coupon} aplicado</p>
            <p className="text-[11px] text-success/80 leading-tight">−{formatBRL(discount)}</p>
          </div>
        </div>
        <button onClick={remove} aria-label="Remover cupom" className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-success/15 text-success transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Cupom presente mas inválido pelas regras atuais (ex: subtotal caiu)
  if (coupon && !valid && warning) {
    return (
      <div className="rounded-xl bg-destructive/5 border border-destructive/30 px-3 py-2 animate-fade-in">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-destructive leading-tight">{coupon} indisponível</p>
              <p className="text-[11px] text-destructive/80 leading-snug mt-0.5">{warning}</p>
            </div>
          </div>
          <button onClick={remove} aria-label="Remover cupom" className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-destructive/15 text-destructive transition-colors shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 animate-fade-in">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error) setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Código do cupom"
            aria-invalid={!!error}
            className={`w-full h-9 pl-8 pr-3 rounded-xl border bg-background text-xs font-semibold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 transition-colors ${error ? "border-destructive/60 focus-visible:ring-destructive/30" : "border-input focus-visible:ring-primary/30"}`}
          />
        </div>
        <button
          onClick={apply}
          disabled={loading || !code.trim()}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 inline-flex items-center justify-center min-w-[64px] active:scale-95 transition-transform"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] font-medium text-destructive animate-fade-in">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}