import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Search, Check, RefreshCcw, DollarSign, Clock, XCircle, AlertTriangle, Handshake, Download } from "lucide-react";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { EmptyState } from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/exportCsv";
import { friendlyErrorMessage } from "@/lib/friendlyError";

type CommissionRow = {
  id: string;
  affiliate_user_id: string;
  order_id: string | null;
  amount: number;
  status: string;
  eligible_release_at: string | null;
  released_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  affiliate_email?: string;
  affiliate_name?: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: "Pendente",  cls: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",     icon: Clock },
  released:  { label: "Liberada",  cls: "bg-primary/15 text-primary ring-1 ring-primary/25",          icon: Check },
  paid:      { label: "Paga",      cls: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25", icon: DollarSign },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground ring-1 ring-border",          icon: XCircle },
  clawback:  { label: "Estorno",   cls: "bg-destructive/15 text-destructive ring-1 ring-destructive/25", icon: AlertTriangle },
};

export function AdminAffiliates() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const MAX = 5000;
    const BATCH = 1000;
    const list: any[] = [];
    for (let offset = 0; offset < MAX; offset += BATCH) {
      const { data, error: err } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + BATCH - 1);
      if (err) {
        const info = logSupabaseError("Carregar comissões", err, { table: "affiliate_commissions", offset });
        setError(info);
        toast.error(`Comissões: ${info.message}`);
        setLoading(false);
        return;
      }
      const rows = (data as any[]) || [];
      list.push(...rows);
      if (rows.length < BATCH) break;
    }
    if (list.length >= MAX) {
      toast.warning("Exibindo as 5.000 comissões mais recentes. Aplique filtros de período para refinar.");
    }
    const ids = Array.from(new Set(list.map((r) => r.affiliate_user_id))).filter(Boolean);
    const profiles: Record<string, { email: string; name: string | null }> = {};
    if (ids.length) {
      const { data: pdata } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", ids);
      for (const p of (pdata as any[]) || []) {
        profiles[p.user_id] = { email: p.email, name: p.full_name };
      }
    }
    setRows(list.map((r) => ({
      ...r,
      affiliate_email: profiles[r.affiliate_user_id]?.email,
      affiliate_name: profiles[r.affiliate_user_id]?.name || undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function releaseDue() {
    setBusy("release-all");
    const { data, error } = await (supabase as any).rpc("release_due_affiliate_commissions");
    setBusy(null);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success(`${data || 0} comissão(ões) liberada(s)`);
    logAdminAction({ action: "affiliate.release_due", entity: "affiliate_commissions", summary: `Liberou ${data || 0} comissões elegíveis` });
    load();
  }

  async function markPaid(c: CommissionRow) {
    const ok = await confirm({
      title: "Marcar comissão como paga?",
      description: `Afiliado: ${c.affiliate_email || c.affiliate_user_id}\nValor: ${formatBRL(c.amount)}`,
      confirmLabel: "Marcar paga",
    });
    if (!ok) return;
    setBusy(c.id);
    const { error } = await (supabase as any).rpc("mark_affiliate_commission_paid", { p_commission_id: c.id });
    setBusy(null);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success("Comissão paga");
    logAdminAction({
      action: "affiliate.mark_paid",
      entity: "affiliate_commissions",
      entityId: c.id,
      summary: `Pagou ${formatBRL(c.amount)} para ${c.affiliate_email || c.affiliate_user_id}`,
    });
    load();
  }

  const totals = useMemo(() => {
    const t = { pending: 0, released: 0, paid: 0, clawback: 0 };
    for (const r of rows) {
      if (r.status in t) (t as any)[r.status] += Number(r.amount || 0);
    }
    return t;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        (r.affiliate_email || "").toLowerCase().includes(q) ||
        (r.affiliate_name || "").toLowerCase().includes(q) ||
        (r.order_id || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  function exportCsv() {
    downloadCsv(
      `comissoes-${new Date().toISOString().slice(0, 10)}`,
      [
        { key: "affiliate_name", label: "afiliado" },
        { key: "affiliate_email", label: "email" },
        { key: "order_id", label: "pedido_id" },
        { key: "amount", label: "valor" },
        { key: "status", label: "status" },
        { key: "eligible_release_at", label: "elegivel_em" },
        { key: "released_at", label: "liberada_em" },
        { key: "paid_at", label: "paga_em" },
        { key: "cancellation_reason", label: "motivo_cancelamento" },
        { key: "created_at", label: "criada_em" },
      ],
      filtered as any,
    );
    toast.success(`${filtered.length} comissões exportadas`);
  }

  const cards = [
    { label: "A liberar (pendente)", value: totals.pending,  cls: "text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20" },
    { label: "A pagar (liberada)",    value: totals.released, cls: "text-primary bg-primary/10 ring-1 ring-primary/20" },
    { label: "Total pago",            value: totals.paid,     cls: "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20" },
    { label: "Estornos pendentes",    value: totals.clawback, cls: "text-destructive bg-destructive/10 ring-1 ring-destructive/25" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-4">
            <p className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${c.cls} mb-2`}>{c.label}</p>
            <p className="text-lg font-bold tabular-nums">{formatBRL(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar afiliado ou pedido…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="released">Liberadas</option>
          <option value="paid">Pagas</option>
          <option value="cancelled">Canceladas</option>
          <option value="clawback">Estornos</option>
        </select>
        <Button variant="outline" size="sm" onClick={releaseDue} disabled={busy === "release-all"}>
          {busy === "release-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Liberar elegíveis
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Afiliado</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Pedido</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Liberação</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando…</td></tr>
              )}
              {!loading && filtered.map((r) => {
                const meta = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.affiliate_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.affiliate_email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">
                      {r.order_id ? `#${r.order_id.slice(0, 8)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(r.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {r.eligible_release_at ? new Date(r.eligible_release_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "released" && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => markPaid(r)}>
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />} Marcar paga
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    icon={Handshake}
                    title="Nenhuma comissão encontrada"
                    description="As comissões serão listadas após pedidos com indicação de afiliado."
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}