import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";
import { toast } from "sonner";

export function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orderRes, itemsRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
    ]);
    if (orderRes.error) {
      const info = logSupabaseError("Carregar pedido", orderRes.error, { table: "orders", order_id: orderId });
      setError(info);
      toast.error(`Pedido: ${info.message}`);
      setLoading(false);
      return;
    }
    if (itemsRes.error) {
      const info = logSupabaseError("Carregar itens do pedido", itemsRes.error, { table: "order_items", order_id: orderId });
      setError(info);
      toast.error(`Itens: ${info.message}`);
      setLoading(false);
      return;
    }
    setOrder(orderRes.data);
    setItems(itemsRes.data || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-xl">Pedido #{orderId.slice(0, 8)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        {error ? (
          <AdminErrorBanner error={error} onRetry={load} />
        ) : loading || !order ? (
          <p className="text-muted-foreground">{loading ? "Carregando…" : "Pedido não encontrado."}</p>
        ) : (
          <>
            <section className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Cliente</h3>
                <p>{order.shipping_full_name}</p>
                <p className="text-muted-foreground">{order.shipping_phone}</p>
                <p className="text-muted-foreground">CPF: {order.shipping_cpf}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Endereço</h3>
                <p>{order.shipping_street}, {order.shipping_number}</p>
                {order.shipping_complement && <p>{order.shipping_complement}</p>}
                <p>{order.shipping_district} — {order.shipping_city}/{order.shipping_state}</p>
                <p className="text-muted-foreground">CEP: {order.shipping_zip}</p>
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-2 text-sm">Itens</h3>
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-3 text-sm">
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} className="w-12 h-12 rounded object-cover bg-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.product_name}</p>
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
                // pix_discount não é persistido; deriva da diferença para refletir 5% real aplicado.
                const pixDisc = order.payment_method === "pix" ? Math.max(0, beforePix - total) : 0;
                return (
                  <>
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(sub)}</span></div>
                    <div className="flex justify-between"><span>Frete</span><span>{formatBRL(ship)}</span></div>
                    <div className="flex justify-between"><span>Seguro</span><span>{formatBRL(ins)}</span></div>
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
                      <span>Total</span>
                      <span className="text-primary">{formatBRL(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">Pagamento: {order.payment_method || "—"}</p>
                  </>
                );
              })()}
            </section>

            {order.notes && (
              <section className="text-sm">
                <h3 className="font-semibold mb-1">Observações</h3>
                <p className="text-muted-foreground">{order.notes}</p>
              </section>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
