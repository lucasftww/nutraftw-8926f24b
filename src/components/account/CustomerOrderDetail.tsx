import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Package, AlertCircle } from "lucide-react";
import { getOrderStatus } from "@/lib/orderStatus";

export function CustomerOrderDetail({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [{ data: o, error: oErr }, { data: it }] = await Promise.all([
          supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
          supabase.from("order_items").select("*").eq("order_id", orderId),
        ]);
        if (oErr) throw oErr;
        if (!o) {
          setError("Pedido não encontrado ou sem permissão de acesso.");
        } else {
          setOrder(o);
          setItems(it || []);
        }
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar pedido.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const status = order ? getOrderStatus(order.status) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pedido #{orderId.slice(0, 8)}
            </h2>
            {order && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : error || !order ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error || "Pedido indisponível."}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <>
            {status && (
              <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${status.color}`}>
                {status.label}
              </div>
            )}

            <section>
              <h3 className="font-semibold mb-2 text-sm">Itens</h3>
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-3 text-sm">
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} loading="lazy" decoding="async" width={56} height={56} className="w-14 h-14 rounded object-cover bg-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-2 leading-snug">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">{it.quantity}x {formatBRL(it.unit_price)}</p>
                    </div>
                    <p className="font-semibold">{formatBRL(it.subtotal)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-muted/30 rounded-xl p-4 space-y-1 text-sm">
              {(() => {
                const sub = Number(order.subtotal || 0);
                const ship = Number(order.shipping || 0);
                const ins = Number(order.insurance || 0);
                const disc = Number(order.discount || 0);
                const total = Number(order.total || 0);
                const beforePix = sub + ship + ins - disc;
                const pixDisc = order.payment_method === "pix" ? Math.max(0, beforePix - total) : 0;
                return (
                  <>
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(sub)}</span></div>
                    <div className="flex justify-between"><span>Frete</span><span>{formatBRL(ship)}</span></div>
                    {ins > 0 && <div className="flex justify-between"><span>Seguro</span><span>{formatBRL(ins)}</span></div>}
                    {disc > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Cupom{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                        <span>− {formatBRL(disc)}</span>
                      </div>
                    )}
                    {pixDisc > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Desconto PIX (5%)</span>
                        <span>− {formatBRL(pixDisc)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                      <span>Total</span><span className="text-primary">{formatBRL(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">Pagamento: {order.payment_method || "—"}</p>
                  </>
                );
              })()}
            </section>

            <section className="text-sm">
              <h3 className="font-semibold mb-2">Endereço de entrega</h3>
              <div className="text-muted-foreground">
                <p>{order.shipping_full_name}</p>
                <p>{order.shipping_street}, {order.shipping_number}{order.shipping_complement ? ` — ${order.shipping_complement}` : ""}</p>
                <p>{order.shipping_district} — {order.shipping_city}/{order.shipping_state}</p>
                <p>CEP: {order.shipping_zip}</p>
                <p>Tel: {order.shipping_phone}</p>
              </div>
            </section>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
