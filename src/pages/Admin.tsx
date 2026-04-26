import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, slugify } from "@/lib/utils";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Pencil } from "lucide-react";

type Tab = "products" | "categories" | "orders";

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("products");

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

      <div className="flex gap-2 mb-6 border-b border-border">
        {(["products", "categories", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "products" ? "Produtos" : t === "categories" ? "Categorias" : "Pedidos"}
          </button>
        ))}
      </div>

      {tab === "products" && <AdminProducts />}
      {tab === "categories" && <AdminCategories />}
      {tab === "orders" && <AdminOrders />}
    </div>
  );
}

function AdminProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*, category:categories(name)").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("display_order"),
    ]);
    setItems(p || []);
    setCats(c || []);
  }
  useEffect(() => { load(); }, []);

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
    if (error) toast.error(error.message);
    else {
      toast.success("Produto guardado");
      setEditing(null);
      load();
    }
  }

  async function del(id: string) {
    if (!confirm("Remover produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
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
            {items.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category?.name || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatBRL(p.price)}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell">{p.stock}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="p-1 hover:bg-muted rounded mr-1"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(p.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
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
              <div className="space-y-2 sm:col-span-2"><Label>URL da imagem</Label><Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
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

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("display_order");
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name, slug: slugify(name) });
    if (error) toast.error(error.message);
    else { setName(""); load(); }
  }
  async function del(id: string) {
    if (!confirm("Remover categoria?")) return;
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

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

function AdminOrders() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data || []));
  }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Estado atualizado");
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Pedido</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Cliente</th>
            <th className="text-right px-4 py-3">Total</th>
            <th className="text-left px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
              <td className="px-4 py-3 hidden md:table-cell">{o.shipping_full_name}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatBRL(o.total)}</td>
              <td className="px-4 py-3">
                <select className="h-9 rounded-lg border border-input bg-background px-2 text-xs" value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                  {["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Nenhum pedido.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
