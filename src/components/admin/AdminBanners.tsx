import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";

export function AdminBanners() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  async function load() {
    setError(null);
    const { data, error: err } = await supabase.from("site_banners" as any).select("*").order("display_order").order("created_at", { ascending: false });
    if (err) {
      const info = logSupabaseError("Carregar banners", err, { table: "site_banners" });
      setError(info);
      toast.error(`Banners: ${info.message}`);
      return;
    }
    setItems((data as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const f = editing;
    const payload: any = {
      title: f.title || null,
      subtitle: f.subtitle || null,
      image_url: f.image_url || null,
      cta_label: f.cta_label || null,
      cta_url: f.cta_url || null,
      active: f.active !== false,
      display_order: Number(f.display_order) || 0,
    };
    const { error } = f.id
      ? await supabase.from("site_banners" as any).update(payload).eq("id", f.id)
      : await supabase.from("site_banners" as any).insert(payload);
    if (error) {
      logSupabaseError("Guardar banner", error, { id: f.id, payload });
      toast.error(error.message);
    } else { toast.success("Banner guardado"); setEditing(null); load(); }
  }

  async function del(id: string) {
    if (!confirm("Remover banner?")) return;
    const { error: err } = await supabase.from("site_banners" as any).delete().eq("id", id);
    if (err) {
      logSupabaseError("Remover banner", err, { id });
      toast.error(err.message);
      return;
    }
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Gerencie o banner exibido no topo da loja.</p>
        <Button onClick={() => setEditing({ active: true, display_order: 0 })}><Plus className="h-4 w-4" /> Novo banner</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((b) => (
          <div key={b.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="aspect-[16/9] bg-muted overflow-hidden">
              {b.image_url ? <img src={b.image_url} alt={b.title || "Banner"} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-sm line-clamp-1">{b.title || "—"}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${b.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {b.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{b.subtitle || "—"}</p>
              <div className="flex gap-1">
                <button onClick={() => setEditing(b)} className="p-1.5 hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(b.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">Nenhum banner cadastrado.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="font-bold text-xl">{editing.id ? "Editar banner" : "Novo banner"}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2"><Label>Imagem</Label>
                <ImageUpload value={editing.image_url || ""} onChange={(url) => setEditing({ ...editing, image_url: url })} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Título</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Subtítulo</Label>
                <Input value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Texto do botão</Label>
                <Input value={editing.cta_label || ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} placeholder="Ver catálogo" />
              </div>
              <div className="space-y-2"><Label>URL do botão</Label>
                <Input value={editing.cta_url || ""} onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })} placeholder="/" />
              </div>
              <div className="space-y-2"><Label>Ordem</Label>
                <Input type="number" value={editing.display_order || 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm pt-7"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Ativo</label>
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
