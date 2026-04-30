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
import { LogOut, Plus, Trash2, Pencil, Search, Eye, LayoutDashboard, Package, Tags, ShoppingBag, Ticket, Truck, Image as ImageIcon, RefreshCcw, Settings, BarChart3, Activity, History, TrendingUp, Users, Download, ChevronUp, ChevronDown, Check, Calendar } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WeeklyReport } from "@/components/admin/WeeklyReport";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminShipping } from "@/components/admin/AdminShipping";
import { AdminBanners } from "@/components/admin/AdminBanners";
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

type Tab = "dashboard" | "funnel" | "reports" | "products" | "categories" | "orders" | "coupons" | "shipping" | "banners" | "users" | "resends" | "settings" | "diagnostics" | "audit";

const TAB_IDS: Tab[] = ["dashboard","funnel","reports","products","categories","orders","coupons","shipping","banners","users","resends","settings","diagnostics","audit"];

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "funnel", label: "Funil", icon: TrendingUp },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "products", label: "Produtos", icon: Package },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "coupons", label: "Cupons", icon: Ticket },
  { id: "shipping", label: "Fretes", icon: Truck },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "users", label: "Usuários", icon: Users },
  { id: "resends", label: "Reenvios", icon: RefreshCcw },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "diagnostics", label: "Diagnóstico", icon: Activity },
  { id: "audit", label: "Histórico", icon: History },
];

export default function Admin() {
  return (
    <ConfirmProvider>
      <AdminInner />
    </ConfirmProvider>
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
            <h1 className="font-display text-xl md:text-3xl font-extrabold text-primary truncate">Painel administrativo</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Sair</span>
          </Button>
        </div>
        {/* Tabs com scroll horizontal e fade lateral indicando que há mais. */}
        <div className="relative">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin -mb-px snap-x snap-mandatory">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`px-3 md:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-t-md ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
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
      {tab === "banners" && <AdminBanners />}
      {tab === "users" && <AdminUsers />}
      {tab === "resends" && <AdminResends />}
      {tab === "settings" && <AdminSettings />}
      {tab === "diagnostics" && <AdminDiagnostics />}
      {tab === "audit" && <AdminAuditLog />}
    </div>
  );
}

function AdminProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();

  async function load() {
    setError(null);
    const [pr, cr] = await Promise.all([
      supabase.from("products").select("*, category:categories(name)").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("display_order"),
    ]);
    if (pr.error) {
      const info = logSupabaseError("Carregar produtos", pr.error, { table: "products" });
      setError(info);
      toast.error(`Produtos: ${info.message}`);
      return;
    }
    if (cr.error) {
      const info = logSupabaseError("Carregar categorias", cr.error, { table: "categories" });
      setError(info);
      toast.error(`Categorias: ${info.message}`);
      return;
    }
    setItems(pr.data || []);
    setCats(cr.data || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.active_principle || "").toLowerCase().includes(q) ||
      (p.category?.name || "").toLowerCase().includes(q),
    );
  }, [items, query]);

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
    if (!confirm("Remover produto?")) return;
    const before = items.find((p) => p.id === id);
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

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto, princípio ativo…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setEditing({ is_active: true })}><Plus className="h-4 w-4" /> Novo produto</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Categoria</th>
              <th className="text-right px-4 py-3">Preço</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
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
                  <button onClick={() => del(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum produto.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="font-bold text-xl">{editing.id ? "Editar produto" : "Novo produto"}</h2>
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
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function AdminCategories() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();

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
    const payload = { name, slug: slugify(name) };
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
  async function del(id: string) {
    if (!confirm("Remover categoria?")) return;
    const before = items.find((c) => c.id === id);
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

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex gap-2 mb-6">
        <Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <ul className="divide-y divide-border">
        {items.map((c) => (
          <li key={c.id} className="flex justify-between items-center py-3">
            <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.slug}</p></div>
            <button onClick={() => del(c.id)} className="p-2 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {items.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma categoria.</p>}
      </ul>
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Paginação server-side: evita carregar milhares de pedidos de uma vez.
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
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
  const filterRef = useRef(filter);
  useEffect(() => {
    if (filterRef.current !== filter) {
      filterRef.current = filter;
      if (page !== 0) {
        setPage(0);
        return; // load() dispara no próximo render via dep [page]
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

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
      const r = window.prompt(
        `Motivo do ${status === "cancelled" ? "cancelamento" : "reembolso"} (opcional, será registrado na comissão):`
      );
      reason = r?.trim() ? r.trim() : null;
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
        <select className="h-11 rounded-xl border border-input bg-background px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button variant="outline" onClick={exportCSV} disabled={loading}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
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
              <tr key={o.id} className="border-t border-border">
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
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
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
