import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Package, AlertCircle, Copy, Check, ShoppingCart } from "lucide-react";
import { paymentLabel } from "@/lib/orderStatus";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { OrderTimeline } from "@/components/account/OrderTimeline";

export function CustomerOrderDetail({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { add, openCart } = useCart();

  // Re-adiciona todos os itens deste pedido ao carrinho atual. Útil para
  // "vou comprar de novo o mesmo": cliente VIP, recompra rotineira.
  function buyAgain() {
    if (!items.length) return;
    let added = 0;
    for (const it of items) {
      if (!it.product_id || !it.unit_price) continue;
      add(
        {
          product_id: it.product_id,
          slug: it.product_slug || it.product_id,
          name: it.product_name,
          price: Number(it.unit_price),
          image_url: it.product_image_url,
        },
        Math.max(1, Number(it.quantity) || 1),
      );
      added++;
    }
    if (added > 0) {
      toast.success(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho`);
      openCart();
      onClose();
    }
  }
  // A11y: trava scroll do body + foca primeiro elemento do modal +
  // ESC fecha + ciclo Tab dentro do modal.
  useBodyScrollLock(true);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose);
  // Limpa timer ao desmontar para evitar setState em componente desmontado.
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
  }, []);

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

  const showPix =
    order &&
    order.payment_method === "pix" &&
    order.status === "pending" &&
    (order.payment_qr_code || order.payment_copy_paste);

  async function copyPix() {
    if (!order?.payment_copy_paste) return;
    try {
      await navigator.clipboard.writeText(order.payment_copy_paste);
      setCopied(true);
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  const titleId = "customer-order-detail-title";

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-card rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto space-y-5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-bold text-lg sm:text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <span>Pedido #{orderId.slice(0, 8)}</span>
            </h2>
            {order && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do pedido"
            className="shrink-0 h-11 w-11 -mr-1 -mt-1 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
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
            {/* Timeline visual do pedido — substitui o badge simples e
                comunica progresso (pending → paid → … → delivered). */}
            <OrderTimeline status={order.status} />

            {showPix && (
              <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2 text-emerald-700">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500 text-white text-xs font-black">PIX</span>
                    Pague para liberar o pedido
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escaneie o QR Code ou copie o código abaixo no app do seu banco.
                  </p>
                </div>
                {order.payment_qr_code && (
                  <div className="flex justify-center bg-white rounded-xl p-3">
                    <img
                      src={order.payment_qr_code}
                      alt="QR Code PIX"
                      width={220}
                      height={220}
                      className="w-[220px] h-[220px] object-contain"
                    />
                  </div>
                )}
                {order.payment_copy_paste && (
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                      PIX copia e cola
                    </div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={order.payment_copy_paste}
                        className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-lg font-mono truncate"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button type="button" onClick={copyPix} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
                        {copied ? <><Check className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Após o pagamento o status atualiza automaticamente em alguns segundos.
                </p>
              </section>
            )}

            <section>
              <h3 className="font-semibold mb-2 text-sm">Itens</h3>
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-3 text-sm">
                    {/* object-contain p-1 — packshots farmacêuticos não-quadrados
                        eram cortados com object-cover (mesma correção dos cards). */}
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} loading="lazy" decoding="async" width={56} height={56} className="w-14 h-14 rounded object-contain p-1 bg-white" />
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
                    <p className="text-xs text-muted-foreground pt-2">Pagamento: {paymentLabel(order.payment_method)}</p>
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

            {/* CTAs do rodapé. "Comprar novamente" só aparece se houver
                itens com product_id válido (produto pode ter sido removido
                do catálogo desde a compra original). */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="sm:w-auto">
                Fechar
              </Button>
              {items.some((it) => it.product_id) && (
                <Button
                  type="button"
                  onClick={buyAgain}
                  className="sm:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Comprar novamente
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
