import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Package } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando pagamento", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  processing: { label: "Em preparação", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  refunded: { label: "Reembolsado", color: "bg-gray-100 text-gray-700" },
};

export function CustomerOrderDetail({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: it }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
      ]);
      setOrder(o);
      setItems(it || []);
    })();
  }, [orderId]);

  const status = order ? STATUS_LABELS[order.status] || { label: order.status, color: "bg-muted" } : null;

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

        {!order ? (
          <p className="text-muted-foreground">Carregando…</p>
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
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} className="w-14 h-14 rounded object-cover bg-muted" />
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
              <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Frete</span><span>{formatBRL(order.shipping)}</span></div>
              <div className="flex justify-between"><span>Seguro</span><span>{formatBRL(order.insurance)}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span><span className="text-primary">{formatBRL(order.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">Pagamento: {order.payment_method || "—"}</p>
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
