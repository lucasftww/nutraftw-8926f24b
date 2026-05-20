import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Award } from "lucide-react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { logSupabaseError, AdminErrorBanner, type AdminErrorInfo } from "@/components/admin/AdminErrorBanner";
import { logAdminAction, shallowDiff } from "@/lib/auditLog";
import { friendlyErrorMessage } from "@/lib/friendlyError";

export function AdminBrands() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();
  const { confirm } = useConfirm();

  async function load() {
    setError(null);
    const { data, error: err } = await supabase
      .from("brands")
      .select("*, products:products(count)")
      .order("display_order");
    if (err) {
      const info = logSupabaseError("Carregar marcas", err, { table: "brands" });
      setError(info);
      toast.error(`Marcas: ${info.message}`);
      return;
    }
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const maxOrder = items.reduce((m, c) => Math.max(m, c.display_order ?? 0), 0);
    const payload = { name: name.trim(), slug: slugify(name), display_order: maxOrder + 10 };
    const { data, error } = await supabase.from("brands").insert(payload).select().maybeSingle();
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    setName("");
    logAdminAction({ action: "create", entity: "brands", entityId: (data as any)?.id ?? null, summary: `Marca criada: ${payload.name}`, diff: { after: data || payload } });
    qc.invalidateQueries({ queryKey: ["brands", "all"] });
    load();
  }

  async function rename(id: string) {
    const v = editName.trim();
    if (!v) { setEditingId(null); return; }
    const before = items.find((c) => c.id === id);
    if (!before || before.name === v) { setEditingId(null); return; }
    const payload = { name: v, slug: slugify(v) };
    const { data, error } = await supabase.from("brands").update(payload).eq("id", id).select().maybeSingle();
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    toast.success("Marca renomeada");
    logAdminAction({ action: "update", entity: "brands", entityId: id, summary: `Marca: ${before.name} → ${v}`, diff: shallowDiff(before, data) });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["brands", "all"] });
    load();
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx]; const b = sorted[swapIdx];
    const prev = items;
    setItems((curr) => curr.map((c) => {
      if (c.id === a.id) return { ...c, display_order: b.display_order };
      if (c.id === b.id) return { ...c, display_order: a.display_order };
      return c;
    }));
    const [r1, r2] = await Promise.all([
      supabase.from("brands").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("brands").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) { setItems(prev); toast.error("Falha ao reordenar"); return; }
    qc.invalidateQueries({ queryKey: ["brands", "all"] });
  }

  async function del(id: string) {
    const before = items.find((c) => c.id === id);
    const ok = await confirm({
      title: "Remover marca?",
      description: `Os produtos vinculados a "${before?.name ?? "esta marca"}" ficarão sem marca.`,
      variant: "destructive",
    });
    if (!ok) return;
    const { error: err } = await supabase.from("brands").delete().eq("id", id);
    if (err) { toast.error(friendlyErrorMessage(err)); return; }
    logAdminAction({ action: "delete", entity: "brands", entityId: id, summary: `Marca removida: ${before?.name ?? id.slice(0, 8)}`, diff: { before } });
    qc.invalidateQueries({ queryKey: ["brands", "all"] });
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;
  const sorted = [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  return (
    <div className="bg-card rounded-2xl border border-border p-5 max-w-2xl">
      <div className="flex gap-2 mb-4">
        <Input
          className="flex-1 min-w-0"
          placeholder="Nova marca (ex.: Synedica, ZPHC, Cooper Pharma)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button onClick={add} className="shrink-0"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <ul className="divide-y divide-border/60">
        {sorted.map((c, idx) => {
          const count = c.products?.[0]?.count ?? 0;
          return (
            <li key={c.id} className="flex items-center gap-2 py-2 group">
              {/* Botões de ordenação maiores (h-9 = 36px) para mobile. */}
              <div className="flex flex-col -space-y-px shrink-0">
                <button type="button" onClick={() => move(c.id, -1)} disabled={idx === 0} aria-label={`Mover ${c.name} para cima`} className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(c.id, 1)} disabled={idx === sorted.length - 1} aria-label={`Mover ${c.name} para baixo`} className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown className="h-4 w-4" /></button>
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
                  <button type="button" className="text-left w-full py-1.5 min-h-[44px]" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                    <p className="font-medium text-sm hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground/70 font-mono">{c.slug}</p>
                  </button>
                )}
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 shrink-0">{count} prod.</span>
              {/* Trash 44x44 mobile, sempre visível (sem invisível no touch). */}
              <button type="button" onClick={() => del(c.id)} aria-label={`Remover ${c.name}`} title="Remover" className="h-11 w-11 md:h-9 md:w-9 inline-flex items-center justify-center rounded-md md:opacity-60 group-hover:opacity-100 hover:bg-destructive/10 text-destructive shrink-0 transition-opacity"><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
        {items.length === 0 && (
          <li>
            <EmptyState icon={Award} title="Nenhuma marca criada" description="Crie marcas para vincular aos produtos (ex.: Synedica, ZPHC, Cooper Pharma)." compact />
          </li>
        )}
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground/80">Clique no nome para renomear · use as setas para reordenar.</p>
    </div>
  );
}