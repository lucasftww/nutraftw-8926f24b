import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";
import { toast } from "sonner";
import { AdminModal } from "./AdminModal";
import { Printer, FileText } from "lucide-react";

function paymentLabel(pm: string | null | undefined): string {
  if (!pm) return "—";
  if (pm === "pix") return "PIX";
  if (pm === "credit_card") return "Cartão";
  if (pm === "boleto") return "Boleto";
  return pm;
}

/**
 * Abre uma janela com layout pronto-para-imprimir (etiqueta + declaração).
 * Não persiste nada — apenas formata os dados do pedido para impressão A4 ou
 * etiqueta 10x15 (depende do CSS @page abaixo).
 */
function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) { toast.error("Permita pop-ups para imprimir"); return; }
  w.document.write(html);
  w.document.close();
  // Aguarda renderizar para acionar print sem cortar conteúdo
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 250);
}

function escapeHtml(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c] as string));
}

function buildShippingLabelHtml(order: any) {
  const e = escapeHtml;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta #${e(order.id.slice(0,8))}</title>
<style>
  @page { size: 100mm 150mm; margin: 4mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 8px; color:#000; }
  .box { border: 2px solid #000; padding: 10px; }
  h2 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; }
  .sm { font-size: 11px; color:#444; }
  .row { font-size: 13px; line-height: 1.35; }
  .row strong { font-size: 14px; }
  hr { border: 0; border-top: 1px dashed #aaa; margin: 8px 0; }
  .id { font-family: 'Courier New', monospace; font-size: 12px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="box">
    <h2>Destinatário</h2>
    <div class="row"><strong>${e(order.shipping_full_name || "—")}</strong></div>
    <div class="row">${e(order.shipping_street)}, ${e(order.shipping_number)}${order.shipping_complement ? " — " + e(order.shipping_complement) : ""}</div>
    <div class="row">${e(order.shipping_district)} — ${e(order.shipping_city)}/${e(order.shipping_state)}</div>
    <div class="row"><strong>CEP: ${e(order.shipping_zip)}</strong></div>
    <div class="sm">Tel.: ${e(order.shipping_phone || "—")}</div>
    <hr>
    <div class="sm">Pedido <span class="id">#${e(order.id)}</span></div>
    <div class="sm">Emitido em ${e(new Date().toLocaleDateString("pt-BR"))}</div>
  </div>
  <script>window.onafterprint = () => window.close();</script>
</body></html>`;
}

function buildDeclarationHtml(order: any, items: any[]) {
  const e = escapeHtml;
  const total = items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
  const rows = items.map((it) => `
    <tr>
      <td>${e(it.product_name)}</td>
      <td style="text-align:center;">${e(it.quantity)}</td>
      <td style="text-align:right;">${e(formatBRL(it.unit_price))}</td>
      <td style="text-align:right;">${e(formatBRL(it.subtotal))}</td>
    </tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Declaração #${e(order.id.slice(0,8))}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Arial, sans-serif; color:#000; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color:#555; font-size: 12px; margin-bottom: 18px; }
  .grid { display:flex; gap: 24px; margin-bottom: 18px; font-size: 13px; }
  .grid > div { flex: 1; }
  .grid h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 4px; color:#444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
  th { background:#f5f5f5; font-size: 11px; text-transform: uppercase; }
  tfoot td { font-weight: bold; border-top: 2px solid #000; border-bottom: 0; }
  .foot { margin-top: 32px; font-size: 11px; color:#555; }
  .id { font-family: 'Courier New', monospace; }
  @media print { .noprint { display: none; } }
</style></head><body>
  <h1>Declaração de conteúdo</h1>
  <div class="sub">Pedido <span class="id">#${e(order.id)}</span> · ${e(new Date(order.created_at).toLocaleString("pt-BR"))}</div>
  <div class="grid">
    <div>
      <h3>Remetente</h3>
      <div>Royal Vita</div>
      <div>contato@royalvita.com.br</div>
    </div>
    <div>
      <h3>Destinatário</h3>
      <div>${e(order.shipping_full_name || "—")}</div>
      <div>CPF: ${e(order.shipping_cpf || "—")}</div>
      <div>${e(order.shipping_street)}, ${e(order.shipping_number)}${order.shipping_complement ? " — " + e(order.shipping_complement) : ""}</div>
      <div>${e(order.shipping_district)} — ${e(order.shipping_city)}/${e(order.shipping_state)}</div>
      <div>CEP: ${e(order.shipping_zip)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Produto</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:right;">Total dos itens</td><td style="text-align:right;">${e(formatBRL(total))}</td></tr></tfoot>
  </table>
  <p class="foot">Documento meramente declaratório do conteúdo da remessa, sem valor fiscal.</p>
  <script>window.onafterprint = () => window.close();</script>
</body></html>`;
}

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
    <AdminModal open onClose={onClose} title={`Pedido #${orderId.slice(0, 8)}`} size="lg">
      <div className="space-y-4">
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
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} loading="lazy" decoding="async" width={48} height={48} className="w-12 h-12 rounded object-cover bg-muted" />
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
                    <p className="text-xs text-muted-foreground pt-2">Pagamento: {paymentLabel(order.payment_method)}</p>
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

            <div className="flex justify-end gap-2 pt-2 flex-wrap">
              <Button variant="outline" onClick={() => openPrintWindow(buildShippingLabelHtml(order))}>
                <Printer className="h-4 w-4" /> Etiqueta
              </Button>
              <Button variant="outline" onClick={() => openPrintWindow(buildDeclarationHtml(order, items))}>
                <FileText className="h-4 w-4" /> Declaração
              </Button>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          </>
        )}
      </div>
    </AdminModal>
  );
}
