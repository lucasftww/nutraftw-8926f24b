import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Settings as SettingsIcon, ArrowRightCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";

type Entry = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  diff: any;
  created_at: string;
};

const ENTITIES = [
  { value: "all", label: "Todas as entidades" },
  { value: "products", label: "Produtos" },
  { value: "categories", label: "Categorias" },
  { value: "coupons", label: "Cupons" },
  { value: "shipping_rates", label: "Fretes" },
  { value: "site_settings", label: "Configurações" },
  { value: "orders", label: "Pedidos" },
  { value: "resends", label: "Reenvios" },
];

const ACTIONS = [
  { value: "all", label: "Todas as ações" },
  { value: "create", label: "Criação" },
  { value: "update", label: "Edição" },
  { value: "delete", label: "Remoção" },
  { value: "status_change", label: "Mudança de estado" },
  { value: "settings_save", label: "Configurações" },
  { value: "update_failed", label: "Falha de update" },
  { value: "divergence_detected", label: "Divergência" },
];

import { STATUS_TONE } from "./statusTone";

const ACTION_META: Record<string, { icon: any; tone: string; label: string }> = {
  create:        { icon: Plus,             tone: STATUS_TONE.ok,    label: "Criou" },
  update:        { icon: Pencil,           tone: STATUS_TONE.info,  label: "Editou" },
  delete:        { icon: Trash2,           tone: STATUS_TONE.error, label: "Removeu" },
  status_change: { icon: ArrowRightCircle, tone: STATUS_TONE.warn,  label: "Mudou estado" },
  settings_save: { icon: SettingsIcon,     tone: STATUS_TONE.muted, label: "Salvou config" },
  update_failed:       { icon: AlertTriangle, tone: STATUS_TONE.error, label: "Update falhou" },
  divergence_detected: { icon: ShieldAlert,   tone: STATUS_TONE.warn,  label: "Divergência" },
};

const PAGE_SIZE = 50;

export function AdminAuditLog() {
  const [items, setItems] = useState<Entry[]>([]);
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q: any = (supabase as any)
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (entity !== "all") q = q.eq("entity", entity);
    if (action !== "all") q = q.eq("action", action);
    const { data, error: err, count } = await q;
    if (err) {
      const info = logSupabaseError("Carregar log", err, { table: "admin_audit_log" });
      setError(info);
      toast.error(`Log: ${info.message}`);
      setLoading(false);
      return;
    }
    setItems((data as Entry[]) || []);
    setTotalCount(count ?? null);
    setLoading(false);
  }, [page, entity, action]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [entity, action]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) =>
      (e.summary || "").toLowerCase().includes(q) ||
      (e.user_email || "").toLowerCase().includes(q) ||
      (e.entity_id || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-bold text-lg">Histórico de ações</h2>
            <p className="text-xs text-muted-foreground">
              Registro imutável de tudo que admins criaram, editaram ou removeram.
              {totalCount != null && <> Total: <strong>{totalCount}</strong></>}
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar resumo, email, ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ENTITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <ul className="divide-y divide-border">
          {filtered.map((e) => {
            const meta = ACTION_META[e.action] || { icon: Pencil, tone: STATUS_TONE.muted, label: e.action };
            const Icon = meta.icon;
            const isOpen = !!expanded[e.id];
            return (
              <li key={e.id}>
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [e.id]: !s[e.id] }))}
                  className="w-full flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className={`shrink-0 inline-flex p-2 rounded-lg ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-sm">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{e.entity}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 truncate">{e.summary || "(sem resumo)"}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span>{e.user_email || e.user_id?.slice(0, 8) || "—"}</span>
                      <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                      {e.entity_id && <span className="font-mono">id: {String(e.entity_id).slice(0, 8)}</span>}
                    </div>
                  </div>
                  {e.diff ? (isOpen
                    ? <ChevronDown className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />) : null}
                </button>
                {isOpen && e.diff && (
                  <div className="px-4 pb-4 -mt-1">
                    <pre className="text-[11px] bg-muted/40 rounded-lg p-3 overflow-x-auto max-h-80 leading-relaxed">
                      {JSON.stringify(e.diff, null, 2)}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-center py-12 text-sm text-muted-foreground">
              {loading ? "Carregando…" : "Nenhuma ação registrada ainda."}
            </li>
          )}
        </ul>
      </div>

      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>Próxima →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
