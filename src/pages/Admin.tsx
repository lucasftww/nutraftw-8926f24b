import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, slugify } from "@/lib/utils";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Pencil, Search, Eye, LayoutDashboard, Package, Tags, ShoppingBag, Ticket, Truck, Image as ImageIcon, RefreshCcw, Settings, BarChart3 } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WeeklyReport } from "@/components/admin/WeeklyReport";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminShipping } from "@/components/admin/AdminShipping";
import { AdminBanners } from "@/components/admin/AdminBanners";
import { AdminResends } from "@/components/admin/AdminResends";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { queryKeys } from "@/lib/queryKeys";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";

type Tab = "dashboard" | "reports" | "products" | "categories" | "orders" | "coupons" | "shipping" | "banners" | "resends" | "settings";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "products", label: "Produtos", icon: Package },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "coupons", label: "Cupons", icon: Ticket },
  { id: "shipping", label: "Fretes", icon: Truck },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "resends", label: "Reenvios", icon: RefreshCcw },
  { id: "settings", label: "Configurações", icon: Settings },
];

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" onClick={logout}><LogOut className="h-4 w-4" /> Sair</Button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "reports" && <WeeklyReport />}
      {tab === "products" && <AdminProducts />}
      {tab === "categories" && <AdminCategories />}
      {tab === "orders" && <AdminOrders />}
      {tab === "coupons" && <AdminCoupons />}
      {tab === "shipping" && <AdminShipping />}
      {tab === "banners" && <AdminBanners />}
      {tab === "resends" && <AdminResends />}
      {tab === "settings" && <AdminSettings />}
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
      stock: Number(f.stock) || 0,
      image_url: f.image_url || null,
      category_id: f.category_id || null,
      is_featured: !!f.is_featured,
      is_active: f.is_active !== false,
    };
    const { error } = f.id
      ? await supabase.from("products").update(payload).eq("id", f.id)
      : await supabase.from("products").insert(payload);
    if (error) {
      logSupabaseError("Guardar produto", error, { id: f.id, name: payload.name });
      toast.error(error.message);
    } else {
      toast.success("Produto guardado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detailRoot });
      load();
    }
  }

  async function del(id: string) {
    if (!confirm("Remover produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      logSupabaseError("Remover produto", error, { id });
      toast.error(error.message);
    } else {
      toast.success("Removido");
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
              <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" required value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Stock</Label><Input type="number" value={editing.stock || 0} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} /></div>
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
              <Button type="submit">Guardar</Button>
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
    const { error } = await supabase.from("categories").insert({ name, slug: slugify(name) });
    if (error) {
      logSupabaseError("Adicionar categoria", error, { name });
      toast.error(error.message);
    } else {
      setName("");
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      load();
    }
  }
  async function del(id: string) {
    if (!confirm("Remover categoria?")) return;
    const { error: err } = await supabase.from("categories").delete().eq("id", id);
    if (err) {
      logSupabaseError("Remover categoria", err, { id });
      toast.error(err.message);
      return;
    }
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
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);
  // Reseta para a primeira página quando o filtro muda.
  useEffect(() => { setPage(0); }, [filter]);

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
    const { error: err } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
    if (err) {
      logSupabaseError("Atualizar estado do pedido", err, { order_id: id, new_status: status });
      toast.error(`Falha ao atualizar: ${err.message}`);
    } else {
      toast.success("Estado atualizado");
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  }

  if (error) {
    return <AdminErrorBanner error={error} onRetry={load} />;
  }

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;

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
