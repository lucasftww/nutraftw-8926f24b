import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";
import { toast } from "sonner";
import { AdminModal } from "./AdminModal";
import { Printer, FileText, Plus, Trash2, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { paymentLabel } from "@/lib/orderStatus";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const REFUND_REASONS: { value: string; label: string }[] = [
  { value: "customer_request", label: "Pedido do cliente" },
  { value: "product_unavailable", label: "Produto indisponível" },
  { value: "shipping_issue", label: "Problema no envio" },
  { value: "payment_issue", label: "Problema no pagamento" },
  { value: "fraud", label: "Fraude" },
  { value: "duplicate_order", label: "Pedido duplicado" },
  { value: "other", label: "Outro" },
];
const REFUND_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", processed: "Processado", failed: "Falhou",
};

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

interface SenderInfo {
  brandName: string;
  brandEmail?: string;
  brandCnpj?: string;
  brandAddress?: string;
}

function buildDeclarationHtml(order: any, items: any[], sender: SenderInfo) {
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
       <div>${e(sender.brandName)}</div>
       ${sender.brandCnpj ? `<div>CNPJ: ${e(sender.brandCnpj)}</div>` : ""}
       ${sender.brandAddress ? `<div>${e(sender.brandAddress)}</div>` : ""}
       ${sender.brandEmail ? `<div>${e(sender.brandEmail)}</div>` : ""}
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
  const [refunds, setRefunds] = useState<any[]>([]);
  const [newRefund, setNewRefund] = useState<{ amount: string; reason: string; notes: string }>({ amount: "", reason: "customer_request", notes: "" });
  const [savingRefund, setSavingRefund] = useState(false);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm } = useConfirm();
  const settings = useSiteSettings();
  const senderInfo: SenderInfo = {
    brandName: settings.brand_name || "Royal Vitta",
    brandEmail: settings.brand_email || undefined,
    brandCnpj: settings.brand_cnpj || undefined,
    brandAddress: settings.brand_address || undefined,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orderRes, itemsRes, refundsRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("order_refunds" as any).select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
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
    setRefunds((refundsRes as any)?.data || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRefund() {
    const amount = Number(String(newRefund.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Informe um valor válido (> 0)"); return; }
    const total = Number(order?.total || 0);
    const already = refunds.filter(r => r.status !== "failed").reduce((s, r) => s + Number(r.amount || 0), 0);
    if (Math.round((amount + already) * 100) > Math.round(total * 100)) {
      toast.error(`Valor excede o total do pedido (${formatBRL(total - already)} disponível)`);
      return;
    }
    setSavingRefund(true);
    const { data, error } = await (supabase.from("order_refunds" as any).insert({
      order_id: orderId,
      amount,
      reason: newRefund.reason,
      notes: newRefund.notes.trim() || null,
      status: "pending",
    }).select().maybeSingle() as any);
    setSavingRefund(false);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success("Estorno registrado");
    logAdminAction({
      action: "create", entity: "order_refunds", entityId: (data as any)?.id ?? null,
      summary: `Estorno ${formatBRL(amount)} em pedido #${orderId.slice(0,8)}`,
      diff: { after: data },
    });
    setNewRefund({ amount: "", reason: "customer_request", notes: "" });
    load();
  }

  async function setRefundStatus(id: string, status: "processed" | "failed") {
    const { error } = await (supabase.from("order_refunds" as any).update({
      status, processed_at: status === "processed" ? new Date().toISOString() : null,
    }).eq("id", id) as any);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(`Estorno marcado como ${REFUND_STATUS_LABEL[status].toLowerCase()}`);
    logAdminAction({ action: "update", entity: "order_refunds", entityId: id, summary: `Estorno → ${status}` });
    load();
  }

  async function delRefund(id: string) {
    const ok = await confirm({
      title: "Remover registro de estorno?",
      description: "Esta ação remove apenas o registro interno; o estorno no PSP, se já feito, não é desfeito.",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await (supabase.from("order_refunds" as any).delete().eq("id", id) as any);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success("Removido");
    logAdminAction({ action: "delete", entity: "order_refunds", entityId: id, summary: "Estorno removido" });
    load();
  }

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
                <p>{order.shipping_full_name || "—"}</p>
                <p className="text-muted-foreground">{order.shipping_phone || "—"}</p>
                <p className="text-muted-foreground">CPF: {order.shipping_cpf || "—"}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Endereço</h3>
                <p>{order.shipping_street || "—"}{order.shipping_number ? `, ${order.shipping_number}` : ""}</p>
                {order.shipping_complement && <p>{order.shipping_complement}</p>}
                <p>{order.shipping_district || "—"} — {order.shipping_city || "—"}/{order.shipping_state || "—"}</p>
                <p className="text-muted-foreground">CEP: {order.shipping_zip || "—"}</p>
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-2 text-sm">Itens</h3>
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-3 text-sm">
                    {/* object-contain p-1: produtos farmacêuticos têm packshots
                        não-quadrados (caixas verticais, frascos, etc.). `cover`
                        cortava o rótulo. `contain` preserva o produto inteiro. */}
                    <img src={it.product_image_url || "/assets/no-image.svg"} alt={it.product_name} loading="lazy" decoding="async" width={48} height={48} className="w-12 h-12 rounded object-contain p-1 bg-white" />
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
                      /* `text-success` em vez de `text-success` hardcoded
                         para garantir contraste correto no admin dark mode
                         (emerald-700 sumia em fundo escuro). */
                      <div className="flex justify-between text-success">
                        <span>Cupom{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                        <span>− {formatBRL(disc)}</span>
                      </div>
                    )}
                    {pixDisc > 0 && (
                      <div className="flex justify-between text-success">
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

            <section className="text-sm border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2"><RefreshCcw className="h-4 w-4" /> Estornos</h3>
                {refunds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Total estornado: {formatBRL(refunds.filter(r => r.status === "processed").reduce((s, r) => s + Number(r.amount || 0), 0))}
                  </span>
                )}
              </div>

              {refunds.length > 0 && (
                <ul className="divide-y divide-border border border-border rounded-xl mb-3 overflow-hidden">
                  {refunds.map((r) => (
                    <li key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{formatBRL(r.amount)} <span className="ml-2 text-xs text-muted-foreground font-normal">{REFUND_REASONS.find(x => x.value === r.reason)?.label ?? r.reason}</span></p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.notes}</p>}
                        <p className="text-2xs text-muted-foreground mt-0.5">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                          {r.processed_at && ` · processado em ${new Date(r.processed_at).toLocaleString("pt-BR")}`}
                        </p>
                      </div>
                      {/* Tons -400 são mais legíveis no admin dark do que -500.
                          Antes "emerald-500" tinha contraste limítrofe em fundo escuro. */}
                      <span className={`badge-pill text-xs ring-1 ${
                        r.status === "processed" ? "bg-success/15 text-success ring-success/30" :
                        r.status === "failed" ? "bg-destructive/15 text-destructive ring-destructive/30" :
                        "bg-warning/15 text-warning ring-amber-500/30"
                      }`}>{REFUND_STATUS_LABEL[r.status] ?? r.status}</span>
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setRefundStatus(r.id, "processed")}>Marcar processado</Button>
                          <Button size="sm" variant="outline" onClick={() => setRefundStatus(r.id, "failed")}>Falhou</Button>
                        </>
                      )}
                      <button onClick={() => delRefund(r.id)} title="Remover" className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="bg-muted/30 rounded-xl p-3 grid sm:grid-cols-[120px,1fr,auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={newRefund.amount} onChange={(e) => setNewRefund({ ...newRefund, amount: e.target.value })} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Motivo</Label>
                  <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={newRefund.reason} onChange={(e) => setNewRefund({ ...newRefund, reason: e.target.value })}>
                    {REFUND_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <Button onClick={addRefund} disabled={savingRefund}>
                  <Plus className="h-4 w-4" /> Registrar
                </Button>
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Input value={newRefund.notes} onChange={(e) => setNewRefund({ ...newRefund, notes: e.target.value })} placeholder="Ex: cliente reportou avaria, transferência via PIX em 06/05" />
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2 flex-wrap">
              <Button variant="outline" onClick={() => openPrintWindow(buildShippingLabelHtml(order))}>
                <Printer className="h-4 w-4" /> Etiqueta
              </Button>
              <Button variant="outline" onClick={() => openPrintWindow(buildDeclarationHtml(order, items, senderInfo))}>
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
