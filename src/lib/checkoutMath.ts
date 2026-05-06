/**
 * Helpers puros do checkout — sem dependência de React/Supabase.
 * Centralizam a aritmética que antes vivia espalhada em Checkout.tsx,
 * facilitando testes unitários e auditoria.
 *
 * As regras refletem o RPC `create_order` (servidor é a fonte da verdade):
 *   - Seguro: 10% do subtotal
 *   - Cupom percentual ou valor fixo (nunca maior que subtotal)
 *   - PIX: 5% de desconto sobre (subtotal + frete + seguro − cupom)
 */

export interface CheckoutItem {
  price: number;            // preço unitário efetivo (já considerando promoção)
  quantity: number;
}

export interface CheckoutInput {
  items: CheckoutItem[];
  shipping: number | null;          // null = ainda não selecionado
  insurance: boolean;
  coupon?: { type: "percent" | "fixed"; value: number } | null;
  paymentMethod: "pix" | "credit_card";
}

export interface CheckoutBreakdown {
  subtotal: number;
  shipping: number;
  shippingKnown: boolean;
  insurance: number;
  couponDiscount: number;
  pixDiscount: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normaliza preço digitado pelo usuário (aceita "10,90" ou "10.90"). */
export function normalizePrice(raw: string | number | null | undefined): number {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function isValidPrice(raw: string | number | null | undefined): boolean {
  const n = normalizePrice(raw);
  return Number.isFinite(n) && n > 0;
}

export function isValidStock(raw: string | number | null | undefined): boolean {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n >= 0;
}

export function calcCheckout(input: CheckoutInput): CheckoutBreakdown {
  const subtotal = round2(
    input.items.reduce((s, it) => s + Math.max(0, it.price) * Math.max(0, it.quantity), 0),
  );
  const shippingKnown = input.shipping != null;
  const shipping = shippingKnown ? Math.max(0, Number(input.shipping)) : 0;
  const insurance = input.insurance ? round2(subtotal * 0.10) : 0;

  let couponDiscount = 0;
  if (input.coupon && input.coupon.value > 0) {
    couponDiscount = input.coupon.type === "percent"
      ? round2(subtotal * input.coupon.value / 100)
      : Math.min(input.coupon.value, subtotal);
  }

  const beforePix = Math.max(0, subtotal + shipping + insurance - couponDiscount);
  const pixDiscount = input.paymentMethod === "pix" ? round2(beforePix * 0.05) : 0;
  const total = round2(beforePix - pixDiscount);

  return {
    subtotal,
    shipping,
    shippingKnown,
    insurance,
    couponDiscount,
    pixDiscount,
    total,
  };
}

/**
 * Aplica uma mudança de status com rollback automático em caso de falha.
 * Pura: recebe a lista atual + um "executor" que faz a chamada remota.
 */
export async function applyStatusChange<T extends { id: string; status: string }>(
  list: T[],
  id: string,
  newStatus: string,
  setList: (next: T[]) => void,
  exec: () => Promise<{ error: unknown | null }>,
): Promise<{ ok: boolean; changed: boolean; error?: unknown }> {
  const current = list.find((x) => x.id === id);
  if (!current) return { ok: false, changed: false, error: new Error("not_found") };
  if (current.status === newStatus) return { ok: true, changed: false };

  const prev = current.status;
  setList(list.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
  const { error } = await exec();
  if (error) {
    setList(list.map((o) => (o.id === id ? { ...o, status: prev } : o)));
    return { ok: false, changed: false, error };
  }
  return { ok: true, changed: true };
}