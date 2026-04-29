import { useEffect, useState } from "react";
import { Loader2, Ticket, Check, X } from "lucide-react";
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

  useEffect(() => {
    setCode(coupon ?? "");
    if (!coupon) { setValid(false); setDiscount(0); }
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
      if (!c || !c.active || (c.expires_at && new Date(c.expires_at) < new Date()) ||
          (c.max_uses != null && c.uses >= c.max_uses) || total < Number(c.min_subtotal || 0)) {
        setValid(false); setDiscount(0); return;
      }
      const d = c.discount_type === "percent"
        ? Math.round(total * Number(c.discount_value) / 100 * 100) / 100
        : Math.min(Number(c.discount_value), total);
      setValid(true);
      setDiscount(d);
    })();
    return () => { cancel = true; };
  }, [coupon, total]);

  async function apply() {
    const v = code.trim().toUpperCase();
    if (!v) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("coupons")
      .select("code, discount_type, discount_value, min_subtotal, expires_at, active, max_uses, uses")
      .eq("code", v)
      .maybeSingle();
    setLoading(false);
    const c = data as any;
    if (!c || !c.active) return toast.error("Cupom inválido");
    if (c.expires_at && new Date(c.expires_at) < new Date()) return toast.error("Cupom expirado");
    if (c.max_uses != null && c.uses >= c.max_uses) return toast.error("Cupom esgotado");
    if (total < Number(c.min_subtotal || 0))
      return toast.error(`Subtotal mínimo: ${formatBRL(Number(c.min_subtotal))}`);
    setCoupon(v);
    toast.success("Cupom aplicado!");
  }

  function remove() {
    setCoupon(null);
    setCode("");
    setValid(false);
    setDiscount(0);
  }

  if (!open && !coupon) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
      >
        <Ticket className="h-3.5 w-3.5" />
        Tem cupom de desconto?
      </button>
    );
  }

  if (coupon && valid) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/30">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 text-success shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-success leading-tight truncate">{coupon} aplicado</p>
            <p className="text-[11px] text-success/80 leading-tight">−{formatBRL(discount)}</p>
          </div>
        </div>
        <button onClick={remove} aria-label="Remover cupom" className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-success/15 text-success">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="Código do cupom"
          className="w-full h-9 pl-8 pr-3 rounded-xl border border-input bg-background text-xs font-semibold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </div>
      <button
        onClick={apply}
        disabled={loading || !code.trim()}
        className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 inline-flex items-center justify-center min-w-[64px]"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
      </button>
    </div>
  );
}