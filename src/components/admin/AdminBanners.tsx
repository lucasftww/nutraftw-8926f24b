import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { logAdminAction } from "@/lib/auditLog";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  display_order: number;
  active: boolean;
};

export function AdminBanners() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from("home_banners")
      .select("*")
      .order("display_order", { ascending: true });
    if (err) {
      const info = logSupabaseError("Carregar banners", err, { table: "home_banners" });
      setError(info);
      toast.error(`Banners: ${info.message}`);
      setLoading(false);
      return;
    }
    setItems((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addNew() {
    setBusy("new");
    const next = (items[items.length - 1]?.display_order ?? -1) + 1;
    const { data, error } = await (supabase as any)
      .from("home_banners")
      .insert({ title: "Novo banner", display_order: next, active: true })
      .select()
      .single();
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setItems([...items, data as any]);
    logAdminAction({ action: "create", entity: "home_banners", entityId: (data as any).id, summary: "Novo banner criado" });
  }

  async function save(b: Banner) {
    setBusy(b.id);
    const { error } = await (supabase as any)
      .from("home_banners")
      .update({
        title: b.title,
        subtitle: b.subtitle,
        image_url: b.image_url,
        link_url: b.link_url,
        active: b.active,
        display_order: b.display_order,
      })
      .eq("id", b.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Banner salvo");
    logAdminAction({ action: "update", entity: "home_banners", entityId: b.id, summary: `Banner "${b.title}" atualizado` });
  }

  async function remove(b: Banner) {
    const ok = await confirm({
      title: "Excluir banner?",
      description: b.title,
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    setBusy(b.id);
    const { error } = await (supabase as any).from("home_banners").delete().eq("id", b.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setItems(items.filter((x) => x.id !== b.id));
    logAdminAction({ action: "delete", entity: "home_banners", entityId: b.id, summary: `Banner "${b.title}" removido` });
  }

  async function move(b: Banner, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === b.id);
    const swap = items[idx + dir];
    if (!swap) return;
    setBusy(b.id);
    const a = { ...b, display_order: swap.display_order };
    const c = { ...swap, display_order: b.display_order };
    const { error } = await (supabase as any).from("home_banners").upsert([
      { id: a.id, display_order: a.display_order },
      { id: c.id, display_order: c.display_order },
    ]);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const next = [...items];
    next[idx] = c; next[idx + dir] = a;
    setItems(next);
  }

  function patch(id: string, p: Partial<Banner>) {
    setItems(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Banners da Home</h2>
          <p className="text-xs text-muted-foreground">Mudanças aparecem imediatamente para os visitantes.</p>
        </div>
        <Button onClick={addNew} disabled={busy === "new"}>
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo banner
        </Button>
      </div>

      {loading && <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando…</div>}

      {!loading && items.length === 0 && (
        <div className="bg-card rounded-2xl border border-border border-dashed p-12 text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Nenhum banner ainda. Clique em "Novo banner" para começar.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {items.map((b, i) => (
          <div key={b.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={i === 0} onClick={() => move(b, -1)} aria-label="Mover para cima"><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" disabled={i === items.length - 1} onClick={() => move(b, 1)} aria-label="Mover para baixo"><ArrowDown className="h-3.5 w-3.5" /></Button>
                <span className="text-xs text-muted-foreground ml-2">#{i + 1}</span>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={b.active} onChange={(e) => patch(b.id, { active: e.target.checked })} />
                Ativo
              </label>
            </div>

            <div>
              <Label className="mb-2 block">Imagem (recomendado 1920×600)</Label>
              <ImageUpload
                value={b.image_url || ""}
                onChange={(url) => patch(b.id, { image_url: url })}
              />
            </div>

            <div>
              <Label>Título</Label>
              <Input value={b.title} onChange={(e) => patch(b.id, { title: e.target.value })} />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input value={b.subtitle || ""} onChange={(e) => patch(b.id, { subtitle: e.target.value })} />
            </div>
            <div>
              <Label>Link (URL ou caminho)</Label>
              <Input value={b.link_url || ""} placeholder="/produto/slug ou https://…" onChange={(e) => patch(b.id, { link_url: e.target.value })} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => remove(b)} disabled={busy === b.id} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
              <Button onClick={() => save(b)} disabled={busy === b.id}>
                {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}