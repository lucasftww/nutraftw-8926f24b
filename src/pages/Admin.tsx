import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, slugify } from "@/lib/utils";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Pencil, Search, Eye, LayoutDashboard, Package, Tags, ShoppingBag, Ticket, Truck, RefreshCcw, Settings, BarChart3, Activity, History, TrendingUp, Users, Download, ChevronUp, ChevronDown, Check, Calendar, Copy, Command } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WeeklyReport } from "@/components/admin/WeeklyReport";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminShipping } from "@/components/admin/AdminShipping";
import { AdminResends } from "@/components/admin/AdminResends";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminDiagnostics } from "@/components/admin/AdminDiagnostics";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminFunnel } from "@/components/admin/AdminFunnel";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminModal } from "@/components/admin/AdminModal";
import { ConfirmProvider, useConfirm } from "@/components/admin/ConfirmDialog";
import { queryKeys } from "@/lib/queryKeys";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { logAdminAction, shallowDiff } from "@/lib/auditLog";
import { useNewOrdersNotifier } from "@/hooks/useNewOrdersNotifier";
import { CommandPalette } from "@/components/admin/CommandPalette";

type Tab = "dashboard" | "funnel" | "reports" | "products" | "categories" | "orders" | "coupons" | "shipping" | "users" | "resends" | "settings" | "diagnostics" | "audit";

const TAB_IDS: Tab[] = ["dashboard","funnel","reports","products","categories","orders","coupons","shipping","users","resends","settings","diagnostics","audit"];

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "funnel", label: "Funil", icon: TrendingUp },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "products", label: "Produtos", icon: Package },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "coupons", label: "Cupons", icon: Ticket },
  { id: "shipping", label: "Fretes", icon: Truck },
  { id: "users", label: "Usuários", icon: Users },
  { id: "resends", label: "Reenvios", icon: RefreshCcw },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "diagnostics", label: "Diagnóstico", icon: Activity },
  { id: "audit", label: "Histórico", icon: History },
];

export default function Admin() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <ConfirmProvider>
        <AdminInner />
      </ConfirmProvider>
    </div>
  );
}

function AdminInner() {
  const { user } = useAuth();
  const nav = useNavigate();
  // Persiste a aba ativa na URL — recarregar mantém o contexto e dá pra
  // compartilhar link direto (?tab=pedidos).
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab") as Tab | null;
  const tab: Tab = urlTab && TAB_IDS.includes(urlTab) ? urlTab : "dashboard";
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "dashboard") next.delete("tab"); else next.set("tab", t);
    setParams(next, { replace: true });
  };

  // Cmd/Ctrl+K abre a paleta de comandos global.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [globalOrderId, setGlobalOrderId] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Notificador realtime de novos pedidos. Limpa o badge ao entrar na aba Pedidos.
  const { unseenCount, clear } = useNewOrdersNotifier();
  useEffect(() => { if (tab === "orders") clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  return (
    <div className="container py-4 md:py-8">
      {/* Header sticky — mantém título e Sair sempre acessíveis. */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 pt-4 pb-3 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex justify-between items-center gap-4 mb-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl md:text-3xl font-extrabold text-foreground truncate">Painel administrativo</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              aria-label="Abrir busca global (Ctrl+K)"
              title="Busca global (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline ml-1.5 text-xs text-muted-foreground">Buscar…</span>
              <kbd className="hidden md:inline ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">⌘K</kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
        {/* Tabs com scroll horizontal e fade lateral indicando que há mais. */}
        <div className="relative">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin -mb-px snap-x snap-mandatory">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`relative px-3 md:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-t-md ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
                {t.id === "orders" && unseenCount > 0 && (
                  <span
                    aria-label={`${unseenCount} novos pedidos`}
                    className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-extrabold leading-none animate-pulse"
                  >
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
        </div>
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "funnel" && <AdminFunnel />}
      {tab === "reports" && <WeeklyReport />}
      {tab === "products" && <AdminProducts />}
      {tab === "categories" && <AdminCategories />}
      {tab === "orders" && <AdminOrders />}
      {tab === "coupons" && <AdminCoupons />}
      {tab === "shipping" && <AdminShipping />}
      {tab === "users" && <AdminUsers />}
      {tab === "resends" && <AdminResends />}
      {tab === "settings" && <AdminSettings />}
      {tab === "diagnostics" && <AdminDiagnostics />}
      {tab === "audit" && <AdminAuditLog />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(t) => setTab(t as Tab)}
        onOpenOrder={(id) => { setTab("orders"); setGlobalOrderId(id); }}
      />
      {globalOrderId && (
        <OrderDetailModal orderId={globalOrderId} onClose={() => setGlobalOrderId(null)} />
      )}
    </div>
  );
}

function AdminProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState<"" | "activate" | "deactivate" | "feature" | "unfeature" | "stock_set" | "stock_inc" | "delete">("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const PAGE_SIZE = 30;
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  // Debounce da busca p/ não bater no servidor a cada tecla.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  // Reset de página quando o termo de busca muda.
  useEffect(() => { setPage(0); }, [debouncedQuery]);

  async function load() {
    setLoading(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("products")
      .select("*, category:categories(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (debouncedQuery) {
      // Busca server-side por nome OU princípio ativo (case-insensitive).
      const safe = debouncedQuery.replace(/[%_,]/g, " ");
      q = q.or(`name.ilike.%${safe}%,active_principle.ilike.%${safe}%`);
    }
    const [pr, cr] = await Promise.all([
      q,
      supabase.from("categories").select("*").order("display_order"),
    ]);
    if (pr.error) {
      const info = logSupabaseError("Carregar produtos", pr.error, { table: "products" });
      setError(info);
      toast.error(`Produtos: ${info.message}`);
      setLoading(false);
      return;
    }
    if (cr.error) {
      const info = logSupabaseError("Carregar categorias", cr.error, { table: "categories" });
      setError(info);
      toast.error(`Categorias: ${info.message}`);
      setLoading(false);
      return;
    }
    setItems(pr.data || []);
    setTotalCount(pr.count ?? null);
    setCats(cr.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, debouncedQuery]);
  // Limpa seleção ao trocar página/filtro.
  useEffect(() => { setSelected(new Set()); }, [page, debouncedQuery]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const f = editing;
    const payload = {
      name: f.name,
      slug: f.slug || slugify(f.name),
      description: f.description || null,
      active_principle: f.active_principle || null,
      composition: f.composition || null,
      price: Number(f.price) || 0,
      sale_price:
        f.sale_price === "" || f.sale_price == null
          ? null
          : Number(f.sale_price),
      stock: Number(f.stock) || 0,
      image_url: f.image_url || null,
      category_id: f.category_id || null,
      is_featured: !!f.is_featured,
      is_active: f.is_active !== false,
    };
    const before = f.id ? items.find((p) => p.id === f.id) : null;
    const { data, error } = f.id
      ? await supabase.from("products").update(payload).eq("id", f.id).select().maybeSingle()
      : await supabase.from("products").insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Guardar produto", error, { id: f.id, name: payload.name });
      toast.error(error.message);
    } else {
      toast.success("Produto guardado");
      const saved: any = data || payload;
      logAdminAction({
        action: f.id ? "update" : "create",
        entity: "products",
        entityId: saved?.id ?? f.id ?? null,
        summary: `Produto "${payload.name}"`,
        diff: f.id ? shallowDiff(before, saved) : { after: saved },
      });
      setEditing(null);
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detailRoot });
      load();
    }
  }

  async function del(id: string) {
    const before = items.find((p) => p.id === id);
    const ok = await confirm({
      title: "Remover produto?",
      description: `O produto "${before?.name ?? "selecionado"}" será removido permanentemente. Esta ação não pode ser desfeita.`,
      variant: "destructive",
      confirmLabel: "Remover",
    });
    if (!ok) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      logSupabaseError("Remover produto", error, { id });
      toast.error(error.message);
    } else {
      toast.success("Removido");
      logAdminAction({
        action: "delete",
        entity: "products",
        entityId: id,
        summary: `Produto removido: ${before?.name ?? id.slice(0, 8)}`,
        diff: { before },
      });
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
    }
  }

  async function duplicate(p: any) {
    // Slug único: tenta `slug-copia`, depois `slug-copia-2`, etc.
    const baseSlug = `${p.slug}-copia`;
    let finalSlug = baseSlug;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await supabase.from("products").select("id").eq("slug", finalSlug).maybeSingle();
      if (!existing) break;
      finalSlug = `${baseSlug}-${i}`;
    }
    const payload = {
      name: `${p.name} (cópia)`,
      slug: finalSlug,
      description: p.description,
      active_principle: p.active_principle,
      composition: p.composition,
      price: p.price,
      sale_price: p.sale_price,
      stock: 0,
      image_url: p.image_url,
      category_id: p.category_id,
      is_featured: false,
      is_active: false, // cópia inativa por padrão para revisão
    };
    const { data, error } = await supabase.from("products").insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Duplicar produto", error, { source_id: p.id });
      toast.error(error.message);
      return;
    }
    toast.success("Produto duplicado (rascunho inativo)");
    logAdminAction({
      action: "create",
      entity: "products",
      entityId: (data as any)?.id ?? null,
      summary: `Produto duplicado de "${p.name}"`,
      diff: { after: data, source_id: p.id },
    });
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    setEditing(data); // já abre para o admin revisar/ajustar
    load();
  }

  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    setSelected((s) => s.size === items.length ? new Set() : new Set(items.map((p) => p.id)));
  }

  async function runBulk() {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);
    let payload: Partial<{ is_active: boolean; is_featured: boolean; stock: number }> = {};
    let needsConfirm = false;
    let summary = "";
    if (bulkAction === "activate") { payload = { is_active: true }; summary = "ativados"; }
    else if (bulkAction === "deactivate") { payload = { is_active: false }; summary = "desativados"; }
    else if (bulkAction === "feature") { payload = { is_featured: true }; summary = "destacados"; }
    else if (bulkAction === "unfeature") { payload = { is_featured: false }; summary = "removidos do destaque"; }
    else if (bulkAction === "stock_set") {
      needsConfirm = true;
      const v = parseInt(bulkValue, 10);
      if (Number.isNaN(v) || v < 0) { toast.error("Informe um stock válido (≥ 0)"); return; }
      payload = { stock: v }; summary = `stock = ${v}`;
    } else if (bulkAction === "stock_inc") {
      // Incremento aplicado um a um (Supabase não tem update relativo simples sem rpc).
      const delta = parseInt(bulkValue, 10);
      if (Number.isNaN(delta)) { toast.error("Informe um valor inteiro (positivo ou negativo)"); return; }
      const ok = await confirm({
        title: `Ajustar stock de ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Será somado ${delta >= 0 ? "+" : ""}${delta} ao stock atual de cada produto.`,
      });
      if (!ok) return;
      setBulkBusy(true);
      let okC = 0, fail = 0;
      for (const id of ids) {
        const cur = items.find((p) => p.id === id)?.stock ?? 0;
        const next = Math.max(0, cur + delta);
        const { error } = await supabase.from("products").update({ stock: next }).eq("id", id);
        if (error) fail++; else okC++;
      }
      setBulkBusy(false);
      logAdminAction({
        action: "update",
        entity: "products",
        entityId: null,
        summary: `Stock ajustado em ${okC} produtos (${delta >= 0 ? "+" : ""}${delta})`,
        diff: { ids, delta },
      });
      if (okC) toast.success(`${okC} produto${okC === 1 ? "" : "s"} atualizado${okC === 1 ? "" : "s"}`);
      if (fail) toast.error(`${fail} falharam`);
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
      return;
    } else if (bulkAction === "delete") {
      const ok = await confirm({
        title: `Remover ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: "Esta ação não pode ser desfeita.",
        variant: "destructive",
        confirmLabel: "Remover",
      });
      if (!ok) return;
      setBulkBusy(true);
      const { error } = await supabase.from("products").delete().in("id", ids);
      setBulkBusy(false);
      if (error) { toast.error(error.message); return; }
      logAdminAction({ action: "delete", entity: "products", entityId: null, summary: `${ids.length} produtos removidos`, diff: { ids } });
      toast.success(`${ids.length} removido${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      load();
      return;
    }

    if (needsConfirm) {
      const ok = await confirm({
        title: `Aplicar a ${ids.length} produto${ids.length === 1 ? "" : "s"}?`,
        description: `Os produtos selecionados terão ${summary}.`,
      });
      if (!ok) return;
    }

    setBulkBusy(true);
    const { error } = await supabase.from("products").update(payload).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    logAdminAction({
      action: "update",
      entity: "products",
      entityId: null,
      summary: `${ids.length} produtos ${summary}`,
      diff: { ids, payload },
    });
    toast.success(`${ids.length} atualizado${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set()); setBulkAction(""); setBulkValue("");
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto ou princípio ativo…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {totalCount != null && (
          <span className="text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? "produto" : "produtos"}
          </span>
        )}
        <Button onClick={() => setEditing({ is_active: true })}><Plus className="h-4 w-4" /> Novo produto</Button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm flex-wrap">
          <span className="font-semibold text-primary">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={bulkBusy}
              value={bulkAction}
              onChange={(e) => { setBulkAction(e.target.value as any); setBulkValue(""); }}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
            >
              <option value="">Ação em massa…</option>
              <option value="activate">Ativar</option>
              <option value="deactivate">Desativar</option>
              <option value="feature">Destacar</option>
              <option value="unfeature">Remover destaque</option>
              <option value="stock_set">Definir stock</option>
              <option value="stock_inc">Somar ao stock (±)</option>
              <option value="delete">Remover</option>
            </select>
            {(bulkAction === "stock_set" || bulkAction === "stock_inc") && (
              <Input
                type="number"
                inputMode="numeric"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkAction === "stock_set" ? "Novo stock" : "+/− qtd"}
                className="h-9 w-28"
              />
            )}
            <Button size="sm" disabled={!bulkAction || bulkBusy} onClick={runBulk}>Aplicar</Button>
            <Button variant="outline" size="sm" onClick={() => { setSelected(new Set()); setBulkAction(""); setBulkValue(""); }}>Limpar</Button>
          </div>
        </div>
      )}

      {/* Mobile: cards. Desktop (md+): tabela. */}
      <ul className="md:hidden space-y-2">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
        ))}
        {!loading && items.map((p) => (
          <li key={p.id} className={`bg-card rounded-2xl border p-3 flex gap-3 ${selected.has(p.id) ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
            <label className="shrink-0 mt-1 inline-flex items-center justify-center w-5 h-5 rounded border border-input cursor-pointer">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} className="sr-only" aria-label={`Selecionar ${p.name}`} />
              {selected.has(p.id) && <Check className="h-3.5 w-3.5 text-primary" />}
            </label>
            <img src={p.image_url || "/assets/no-image.svg"} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.category?.name || "Sem categoria"}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-bold text-primary text-sm">{formatBRL(p.price)}</span>
                <span className={`text-[11px] tabular-nums ${p.stock < 5 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                  Stock: {p.stock}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => setEditing(p)} aria-label="Editar" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => duplicate(p)} aria-label="Duplicar" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted"><Copy className="h-4 w-4" /></button>
              <button onClick={() => del(p.id)} aria-label="Remover" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {!loading && items.length === 0 && (
          <li className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">Nenhum produto.</li>
        )}
      </ul>

      <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Categoria</th>
              <th className="text-right px-4 py-3">Preço</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-3" colSpan={6}><div className="h-10 bg-muted/50 rounded animate-pulse" /></td>
              </tr>
            ))}
            {!loading && items.map((p) => (
              <tr key={p.id} className={`border-t border-border ${selected.has(p.id) ? "bg-primary/5" : ""}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.image_url || "/assets/no-image.svg"} alt="" className="w-10 h-10 rounded object-cover bg-muted" />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {!p.is_active && <span className="text-xs text-muted-foreground">Inativo</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category?.name || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatBRL(p.price)}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <span className={p.stock < 5 ? "text-destructive font-semibold" : ""}>{p.stock}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded mr-1"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => duplicate(p)} aria-label="Duplicar" title="Duplicar" className="p-1.5 hover:bg-muted rounded mr-1"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => del(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum produto.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>Próxima →</Button>
          </div>
        </div>
      )}

      <AdminModal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar produto" : "Novo produto"} size="lg">
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input required value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={editing.slug || ""} placeholder="auto" onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div className="space-y-2"><Label>Categoria</Label>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" value={editing.category_id || ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">— Sem categoria —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" min="0" required value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preço promocional (R$)</Label><Input type="number" step="0.01" min="0" placeholder="opcional" value={editing.sale_price ?? ""} onChange={(e) => setEditing({ ...editing, sale_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Stock</Label><Input type="number" min="0" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Imagem</Label>
                <ImageUpload value={editing.image_url || ""} onChange={(url) => setEditing({ ...editing, image_url: url })} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><textarea className="w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[80px]" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="space-y-2"><Label>Princípio ativo</Label><Input value={editing.active_principle || ""} onChange={(e) => setEditing({ ...editing, active_principle: e.target.value })} /></div>
              <div className="space-y-2"><Label>Composição</Label><Input value={editing.composition || ""} onChange={(e) => setEditing({ ...editing, composition: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Em destaque</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Ativo</label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border sticky bottom-0 bg-card">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        )}
      </AdminModal>
    </>
  );
}

function AdminCategories() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  async function load() {
    setError(null);
    const { data, error: err } = await supabase.from("categories").select("*").order("display_order");
    if (err) {
      const info = logSupabaseError("Carregar categorias", err, { table: "categories" });
      setError(info);
      toast.error(`Categorias: ${info.message}`);
      return;
    }
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const maxOrder = items.reduce((m, c) => Math.max(m, c.display_order ?? 0), 0);
    const payload = { name: name.trim(), slug: slugify(name), display_order: maxOrder + 1 };
    const { data, error } = await supabase.from("categories").insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Adicionar categoria", error, { name });
      toast.error(error.message);
    } else {
      setName("");
      logAdminAction({
        action: "create",
        entity: "categories",
        entityId: (data as any)?.id ?? null,
        summary: `Categoria criada: ${payload.name}`,
        diff: { after: data || payload },
      });
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      load();
    }
  }

  async function rename(id: string) {
    const v = editName.trim();
    if (!v) { setEditingId(null); return; }
    const before = items.find((c) => c.id === id);
    if (!before || before.name === v) { setEditingId(null); return; }
    const payload = { name: v, slug: slugify(v) };
    const { data, error } = await supabase.from("categories").update(payload).eq("id", id).select().maybeSingle();
    if (error) {
      logSupabaseError("Renomear categoria", error, { id });
      toast.error(error.message);
      return;
    }
    toast.success("Categoria renomeada");
    logAdminAction({
      action: "update",
      entity: "categories",
      entityId: id,
      summary: `Categoria renomeada: ${before.name} → ${v}`,
      diff: shallowDiff(before, data),
    });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    load();
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    // Atualização otimista + rollback se falhar.
    const prev = items;
    setItems((curr) => curr.map((c) => {
      if (c.id === a.id) return { ...c, display_order: b.display_order };
      if (c.id === b.id) return { ...c, display_order: a.display_order };
      return c;
    }));
    const [r1, r2] = await Promise.all([
      supabase.from("categories").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("categories").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      setItems(prev);
      toast.error("Falha ao reordenar");
      return;
    }
    qc.invalidateQueries({ queryKey: queryKeys.categories.all });
  }

  async function del(id: string) {
    const before = items.find((c) => c.id === id);
    const ok = await confirm({
      title: "Remover categoria?",
      description: `Os produtos vinculados a "${before?.name ?? "esta categoria"}" ficarão sem categoria.`,
      variant: "destructive",
    });
    if (!ok) return;
    const { error: err } = await supabase.from("categories").delete().eq("id", id);
    if (err) {
      logSupabaseError("Remover categoria", err, { id });
      toast.error(err.message);
      return;
    }
    logAdminAction({
      action: "delete",
      entity: "categories",
      entityId: id,
      summary: `Categoria removida: ${before?.name ?? id.slice(0, 8)}`,
      diff: { before },
    });
    qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;
  const sorted = [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex gap-2 mb-6">
        <Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <ul className="divide-y divide-border">
        {sorted.map((c, idx) => (
          <li key={c.id} className="flex items-center gap-2 py-3">
            <div className="flex flex-col">
              <button
                onClick={() => move(c.id, -1)}
                disabled={idx === 0}
                aria-label={`Mover ${c.name} para cima`}
                className="h-5 w-6 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => move(c.id, 1)}
                disabled={idx === sorted.length - 1}
                aria-label={`Mover ${c.name} para baixo`}
                className="h-5 w-6 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              {editingId === c.id ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => rename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); rename(c.id); }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="text-left w-full"
                  onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                >
                  <p className="font-medium hover:text-primary transition-colors">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.slug}</p>
                </button>
              )}
            </div>
            <button onClick={() => del(c.id)} aria-label={`Remover ${c.name}`} className="p-2 hover:bg-destructive/10 text-destructive rounded shrink-0"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {items.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma categoria.</p>}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">Toque no nome para renomear · use as setas para reordenar.</p>
    </div>
  );
}

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

function AdminOrders() {
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
  // Paginação server-side: evita carregar milhares de pedidos de uma vez.
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
      // Apenas as colunas usadas na lista — reduz payload em ~70%.
      .select(
        "id, created_at, status, total, payment_method, shipping_full_name, shipping_cpf",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (filter !== "all") q = q.eq("status", filter as any);
    if (paymentFilter !== "all") q = q.eq("payment_method", paymentFilter as any);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom + "T00:00:00").toISOString());
    if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
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
  // Reseta para a primeira página quando o filtro muda — fazer ANTES do
  // efeito de load() para não disparar duas requisições (page atual + page=0)
  // que poderiam causar race condition (resposta antiga sobrescreve nova).
  const filterRef = useRef(`${filter}|${paymentFilter}|${dateFrom}|${dateTo}`);
  useEffect(() => {
    const key = `${filter}|${paymentFilter}|${dateFrom}|${dateTo}`;
    if (filterRef.current !== key) {
      filterRef.current = key;
      if (page !== 0) {
        setPage(0);
        return; // load() dispara no próximo render via dep [page]
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, paymentFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((o) => {
      // status já filtrado server-side; busca client-side só refina.
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.shipping_full_name || "").toLowerCase().includes(q) ||
        (o.shipping_cpf || "").includes(q)
      );
    });
  }, [items, query]);

  async function setStatus(id: string, status: string) {
    const before = items.find((o) => o.id === id);
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
      // null = cancelou o diálogo; string vazia = confirmou sem motivo.
      if (r === null) return;
      reason = r.trim() ? r.trim() : null;
    }
    const { error: err } = await supabase.rpc("admin_set_order_status", {
      p_order_id: id,
      p_status: status,
      p_reason: reason,
    });
    if (err) {
      logSupabaseError("Atualizar estado do pedido", err, { order_id: id, new_status: status });
      toast.error(`Falha ao atualizar: ${err.message}`);
    } else {
      toast.success("Estado atualizado");
      // O audit log já é gravado pelo admin_set_order_status no servidor.
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  }

  async function bulkSetStatus(status: string) {
    if (selected.size === 0) return;
    const isDestructive = status === "cancelled" || status === "refunded";
    const ok = await confirm({
      title: `Marcar ${selected.size} pedido${selected.size === 1 ? "" : "s"} como "${status}"?`,
      description: isDestructive
        ? "Esta ação cancelará/reembolsará vários pedidos de uma vez."
        : "Os pedidos selecionados terão o estado atualizado.",
      variant: isDestructive ? "destructive" : "default",
      confirmLabel: "Aplicar",
    });
    if (!ok) return;
    setBulkBusy(true);
    let okCount = 0, failCount = 0;
    for (const id of selected) {
      const { error: err } = await supabase.rpc("admin_set_order_status", {
        p_order_id: id, p_status: status, p_reason: null,
      });
      if (err) failCount++; else okCount++;
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
    // Exporta TODOS os pedidos do filtro atual (não só a página). Limita a 5000 por segurança.
    let q = supabase
      .from("orders")
      .select(
        "id, created_at, status, payment_method, total, subtotal, shipping, insurance, discount, coupon_code, shipping_full_name, shipping_cpf, shipping_phone, shipping_zip, shipping_city, shipping_state",
      )
      .order("created_at", { ascending: false })
      .limit(5000);
    if (filter !== "all") q = q.eq("status", filter as any);
    if (paymentFilter !== "all") q = q.eq("payment_method", paymentFilter as any);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom + "T00:00:00").toISOString());
    if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
    const { data, error: err } = await q;
    if (err || !data) {
      toast.error(`Falha ao exportar: ${err?.message ?? "sem dados"}`);
      return;
    }
    const headers = [
      "id", "created_at", "status", "payment_method", "total", "subtotal",
      "shipping", "insurance", "discount", "coupon_code", "customer_name",
      "cpf", "phone", "zip", "city", "state",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const rows = data.map((o: any) => [
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
    toast.success(`${data.length} pedidos exportados`);
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por ID, nome ou CPF…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filtrar por pagamento">
          <option value="all">Todos pagamentos</option>
          <option value="pix">PIX</option>
          <option value="card">Cartão</option>
        </select>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <Input type="date" className="h-11 w-[140px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Data inicial" />
          <span>até</span>
          <Input type="date" className="h-11 w-[140px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Data final" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs underline text-muted-foreground hover:text-foreground">limpar</button>
          )}
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={loading}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <span className="font-semibold text-primary">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select disabled={bulkBusy} onChange={(e) => { if (e.target.value) { bulkSetStatus(e.target.value); e.currentTarget.selectedIndex = 0; } }} className="h-9 rounded-lg border border-input bg-background px-2 text-xs">
              <option value="">Alterar status para…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      {/* Mobile: cards. Desktop (md+): tabela. */}
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
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[o.status] || "bg-muted"}`}>{o.status}</span>
                </div>
                <p className="font-semibold text-sm leading-tight truncate mt-1">{o.shipping_full_name || "—"}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")} · {o.payment_method || "—"}</span>
                  <span className="font-bold text-primary text-sm">{formatBRL(o.total)}</span>
                </div>
              </div>
              <button onClick={() => setDetailId(o.id)} aria-label="Ver detalhes" className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted shrink-0"><Eye className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {!loading && filtered.length === 0 && <li className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">Nenhum pedido.</li>}
      </ul>

      <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={filtered.length > 0 && selected.size === filtered.length}
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
                  {new Date(o.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatBRL(o.total)}</td>
                <td className="px-4 py-3">
                  <select
                    className={`h-8 rounded-lg border-0 px-2 text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-muted"}`}
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDetailId(o.id)} className="p-1.5 hover:bg-muted rounded"><Eye className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  {loading ? "Carregando pedidos…" : "Nenhum pedido."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
