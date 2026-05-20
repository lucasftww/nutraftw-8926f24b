import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Eye, ShoppingBag, Download, Check, Calendar } from "lucide-react";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ORDER_STATUSES,
  STATUS_PT,
  ADMIN_STATUS_COLORS,
  paymentLabel,
} from "@/lib/orderStatus";

// Alias local mantido por compat — referencia o array exportado.
const STATUSES = ORDER_STATUSES;

export function AdminOrders() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, promptText } = useConfirm();
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("orders")
      .select(
        "id, created_at, status, total, payment_method, shipping_full_name, shipping_cpf",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (filter !== "all") q = q.eq("status", filter as any);
    if (paymentFilter !== "all") q = q.eq("payment_method", paymentFilter as any);
    // Filtros de data: o admin escolhe "01/05/2026" pensando em SP (UTC-3).
    // Usar `new Date("2026-05-01T00:00:00")` interpreta como horário local do
    // navegador, mas o cliente pode estar em outro fuso (acessando remoto).
    // Forçamos -03:00 para alinhar com o fuso da loja (Brasil), evitando
    // que pedidos do dia anterior apareçam por causa do offset UTC.
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom + "T00:00:00-03:00").toISOString());
    if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59.999-03:00").toISOString());
    const { data, error: err, count } = await q;
    if (err) {
      const info = logSupabaseError("Carregar pedidos", err, { table: "orders", page, filter });
      setError(info);
      toast.error(`Pedidos: ${info.message}`);
      setLoading(false);
      return;
    }
    setItems(data || []);
    setTotalCount(count ?? null);
    setLoading(false);
  }
  const filterRef = useRef(`${filter}|${paymentFilter}|${dateFrom}|${dateTo}`);
  useEffect(() => {
    const key = `${filter}|${paymentFilter}|${dateFrom}|${dateTo}`;
    if (filterRef.current !== key) {
      filterRef.current = key;
      if (page !== 0) {
        setPage(0);
        return;
      }
    }
    load();
  }, [page, filter, paymentFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((o) => {
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.shipping_full_name || "").toLowerCase().includes(q) ||
        (o.shipping_cpf || "").includes(q)
      );
    });
  }, [items, query]);

  useEffect(() => {
    setSelected(new Set());
    setPage(0);
  }, [query]);

  async function setStatus(id: string, status: string) {
    const prev = items.find((o) => o.id === id)?.status;
    if (prev === status) return;
    let reason: string | null = null;
    if (status === "cancelled" || status === "refunded") {
      const label = status === "cancelled" ? "cancelamento" : "reembolso";
      const r = await promptText({
        title: `Motivo do ${label}`,
        description: "Será registrado no histórico e na comissão (opcional).",
        prompt: { label: "Motivo", placeholder: "Ex.: cliente solicitou…" },
        confirmLabel: "Confirmar",
        variant: "destructive",
      });
      if (r === null) return;
      reason = r.trim() ? r.trim() : null;
    }
    // Otimista: aplica imediatamente; rollback se falhar.
    setItems((p) => p.map((o) => (o.id === id ? { ...o, status } : o)));
    const { error: err } = await supabase.rpc("admin_set_order_status", {
      p_order_id: id,
      p_status: status,
      p_reason: reason,
    });
    if (err) {
      logSupabaseError("Atualizar estado do pedido", err, { order_id: id, new_status: status });
      toast.error(`Falha ao atualizar: ${friendlyErrorMessage(err)}`);
      // Rollback
      setItems((p) => p.map((o) => (o.id === id ? { ...o, status: prev } : o)));
    } else {
      toast.success("Estado atualizado");
    }
  }

  async function bulkSetStatus(status: string) {
    if (selected.size === 0) return;
    const visibleIds = new Set(filtered.map((o) => o.id));
    const scopedIds = Array.from(selected).filter((id) => visibleIds.has(id));
    if (scopedIds.length === 0) {
      toast.error("Nenhum pedido visível selecionado para atualizar.");
      setSelected(new Set());
      return;
    }
    const isDestructive = status === "cancelled" || status === "refunded";
    const statusPt = STATUS_PT[status as keyof typeof STATUS_PT] ?? status;
    const ok = await confirm({
      title: `Marcar ${scopedIds.length} pedido${scopedIds.length === 1 ? "" : "s"} como "${statusPt}"?`,
      description: isDestructive
        ? "Esta ação cancelará/reembolsará vários pedidos de uma vez."
        : "Os pedidos selecionados terão o estado atualizado.",
      variant: isDestructive ? "destructive" : "default",
      confirmLabel: "Aplicar",
    });
    if (!ok) return;
    setBulkBusy(true);
    // PARALELO em vez de sequencial: antes este loop fazia N× round-trips
    // serializados. Para 50 pedidos numa conexão BR (latência ~100ms), levava
    // 5+ segundos. Agora dispara tudo de uma vez — Supabase aguenta facilmente
    // 50 RPCs paralelas e o tempo total cai para ~latência única (~200ms).
    const results = await Promise.allSettled(
      scopedIds.map((id) =>
        supabase.rpc("admin_set_order_status", {
          p_order_id: id, p_status: status, p_reason: null,
        })
      )
    );
    let okCount = 0, failCount = 0;
    for (const r of results) {
      if (r.status === "rejected" || (r.value as { error?: unknown })?.error) failCount++;
      else okCount++;
    }
    setBulkBusy(false);
    if (okCount) toast.success(`${okCount} pedido${okCount === 1 ? "" : "s"} atualizado${okCount === 1 ? "" : "s"}`);
    if (failCount) toast.error(`${failCount} falharam`);
    setSelected(new Set());
    load();
  }

  function toggleSel(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((o: any) => o.id)));
  }

  if (error) {
    return <AdminErrorBanner error={error} onRetry={load} />;
  }

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;

  async function exportCSV() {
    // Bug fix: antes usava .limit(5000) silencioso. Agora pagina em lotes
    // de 1000 (limite do PostgREST) e avisa se atingir o teto de segurança.
    const MAX = 20000;
    const BATCH = 1000;
    const all: any[] = [];
    const buildQuery = (from: number, to: number) => {
      let q = supabase
      .from("orders")
      .select(
        "id, created_at, status, payment_method, total, subtotal, shipping, insurance, discount, coupon_code, shipping_full_name, shipping_cpf, shipping_phone, shipping_zip, shipping_city, shipping_state",
      )
      .order("created_at", { ascending: false })
        .range(from, to);
      if (filter !== "all") q = q.eq("status", filter as any);
      if (paymentFilter !== "all") q = q.eq("payment_method", paymentFilter as any);
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom + "T00:00:00-03:00").toISOString());
      if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59.999-03:00").toISOString());
      return q;
    };
    for (let offset = 0; offset < MAX; offset += BATCH) {
      const { data, error: err } = await buildQuery(offset, offset + BATCH - 1);
      if (err) {
        toast.error(`Falha ao exportar: ${friendlyErrorMessage(err)}`);
        return;
      }
      const rows = data || [];
      all.push(...rows);
      if (rows.length < BATCH) break;
    }
    const headers = [
      "id", "created_at", "status", "payment_method", "total", "subtotal",
      "shipping", "insurance", "discount", "coupon_code", "customer_name",
      "cpf", "phone", "zip", "city", "state",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      let s = String(v).replace(/"/g, '""');
      // Sanitiza prefixos de fórmula (CSV injection — Excel executaria como expressão).
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const rows = all.map((o: any) => [
      o.id, o.created_at, o.status, o.payment_method, o.total, o.subtotal,
      o.shipping, o.insurance, o.discount, o.coupon_code, o.shipping_full_name,
      o.shipping_cpf, o.shipping_phone, o.shipping_zip, o.shipping_city, o.shipping_state,
    ].map(escape).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (all.length >= MAX) {
      toast.warning(`Exportados ${all.length} pedidos (limite atingido — aplique filtros para o restante)`);
    } else {
      toast.success(`${all.length} pedidos exportados`);
    }
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por ID, nome ou CPF…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={loading} className="shrink-0">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center">
          <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm min-w-0" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por estado">
            <option value="all">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_PT[s]}</option>)}
          </select>
          <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm min-w-0" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filtrar por pagamento">
            <option value="all">Todos pagamentos</option>
            <option value="pix">PIX</option>
            <option value="credit_card">Cartão</option>
          </select>
          <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <Input type="date" className="h-11 flex-1 sm:w-[140px] sm:flex-none min-w-0" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Data inicial" />
            <span className="shrink-0">até</span>
            <Input type="date" className="h-11 flex-1 sm:w-[140px] sm:flex-none min-w-0" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Data final" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs underline text-muted-foreground hover:text-foreground shrink-0">limpar</button>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <span className="font-semibold text-primary">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select disabled={bulkBusy} onChange={(e) => { if (e.target.value) { bulkSetStatus(e.target.value); e.currentTarget.selectedIndex = 0; } }} className="h-9 rounded-lg border border-input bg-background px-2 text-xs">
              <option value="">Alterar status para…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_PT[s]}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      <ul className="md:hidden space-y-2">
        {loading && Array.from({ length: 5 }).map((_, i) => <li key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />)}
        {!loading && filtered.map((o) => (
          <li key={o.id} className={`bg-card rounded-2xl border p-3 ${selected.has(o.id) ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
            <div className="flex items-start gap-2">
              <label className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border border-input cursor-pointer">
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSel(o.id)} className="sr-only" />
                {selected.has(o.id) && <Check className="h-3.5 w-3.5 text-primary" />}
              </label>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ADMIN_STATUS_COLORS[o.status as keyof typeof ADMIN_STATUS_COLORS] || "bg-muted text-muted-foreground"}`}>{STATUS_PT[o.status as keyof typeof STATUS_PT] ?? o.status}</span>
                </div>
                <p className="font-semibold text-sm leading-tight truncate mt-1">{o.shipping_full_name || "—"}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")} · {paymentLabel(o.payment_method)}</span>
                  <span className="font-bold text-primary text-sm">{formatBRL(o.total)}</span>
                </div>
              </div>
              <button onClick={() => setDetailId(o.id)} aria-label="Ver detalhes" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted shrink-0"><Eye className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="bg-card rounded-2xl border border-border">
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum pedido encontrado"
              description="Quando uma compra for feita, ela aparecerá aqui."
            />
          </li>
        )}
      </ul>

      <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selected.size > 0 && selected.size < filtered.length;
                    }
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left px-4 py-3">Pedido</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Cliente</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Data</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className={`border-t border-border ${selected.has(o.id) ? "bg-primary/5" : ""}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" aria-label={`Selecionar pedido ${o.id.slice(0, 8)}`} checked={selected.has(o.id)} onChange={() => toggleSel(o.id)} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 hidden md:table-cell">{o.shipping_full_name || "—"}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                  <div className="flex flex-col leading-tight">
                    <span>{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                    <span className="text-[10px] text-muted-foreground/70" title={new Date(o.created_at).toLocaleString("pt-BR")}>
                      {formatDistanceToNow(new Date(o.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatBRL(o.total)}</td>
                <td className="px-4 py-3">
                  <select
                    className={`h-8 rounded-lg border-0 px-2 text-xs font-semibold ${ADMIN_STATUS_COLORS[o.status as keyof typeof ADMIN_STATUS_COLORS] || "bg-muted"}`}
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} style={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>{STATUS_PT[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDetailId(o.id)} aria-label={`Ver detalhes do pedido ${o.id.slice(0, 8)}`} className="p-1.5 hover:bg-muted rounded"><Eye className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-t border-border">
                <td className="px-4 py-3" colSpan={7}>
                  <div className="h-10 bg-muted/50 rounded animate-pulse" />
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={ShoppingBag}
                    title="Nenhum pedido encontrado"
                    description="Quando uma compra for feita, ela aparecerá aqui."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Página {page + 1} de {totalPages}
            {totalCount != null && <> · {totalCount} pedidos</>}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}

      {detailId && <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}