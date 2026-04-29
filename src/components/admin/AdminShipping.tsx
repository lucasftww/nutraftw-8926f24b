import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { queryKeys } from "@/lib/queryKeys";
import { logAdminAction, shallowDiff } from "@/lib/auditLog";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function AdminShipping() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();

  async function load() {
    setError(null);
    const { data, error: err } = await supabase.from("shipping_rates" as any).select("*").order("state");
    if (err) {
      const info = logSupabaseError("Carregar fretes", err, { table: "shipping_rates" });
      setError(info);
      toast.error(`Fretes: ${info.message}`);
      return;
    }
    setItems((data as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const f = editing;
    const payload: any = {
      state: (f.state || "").toUpperCase(),
      label: f.label || "Padrão",
      price: Number(f.price) || 0,
      delivery_days_min: f.delivery_days_min ? Number(f.delivery_days_min) : null,
      delivery_days_max: f.delivery_days_max ? Number(f.delivery_days_max) : null,
      active: f.active !== false,
    };
    // Evita criar dois fretes com mesmo (UF, modalidade) — não há UNIQUE no banco.
    const dup = items.find(
      (s) => s.state === payload.state && (s.label || "").toLowerCase() === payload.label.toLowerCase() && s.id !== f.id,
    );
    if (dup) {
      toast.error(`Já existe um frete "${payload.label}" para ${payload.state}.`);
      return;
    }
    if (
      payload.delivery_days_min != null &&
      payload.delivery_days_max != null &&
      payload.delivery_days_min > payload.delivery_days_max
    ) {
      toast.error("Prazo mínimo não pode ser maior que o máximo.");
      return;
    }
    const before = f.id ? items.find((s) => s.id === f.id) : null;
    const { data, error } = f.id
      ? await supabase.from("shipping_rates" as any).update(payload).eq("id", f.id).select().maybeSingle()
      : await supabase.from("shipping_rates" as any).insert(payload).select().maybeSingle();
    if (error) {
      logSupabaseError("Guardar frete", error, { id: f.id, payload });
      toast.error(error.message);
    } else {
      toast.success("Frete guardado");
      const saved: any = data || payload;
      logAdminAction({
        action: f.id ? "update" : "create",
        entity: "shipping_rates",
        entityId: saved?.id ?? f.id ?? null,
        summary: `Frete ${payload.state} ${payload.label} (R$ ${payload.price.toFixed(2)})`,
        diff: f.id ? shallowDiff(before, saved) : { after: saved },
      });
      setEditing(null);
      qc.invalidateQueries({ queryKey: queryKeys.shippingRates.all });
      load();
    }
  }

  async function del(id: string) {
    if (!confirm("Remover frete?")) return;
    const before = items.find((s) => s.id === id);
    const { error: err } = await supabase.from("shipping_rates" as any).delete().eq("id", id);
    if (err) {
      logSupabaseError("Remover frete", err, { id });
      toast.error(err.message);
      return;
    }
    logAdminAction({
      action: "delete",
      entity: "shipping_rates",
      entityId: id,
      summary: `Frete removido: ${before?.state ?? "?"} ${before?.label ?? ""}`.trim(),
      diff: { before },
    });
    qc.invalidateQueries({ queryKey: queryKeys.shippingRates.all });
    load();
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Defina o valor de frete e prazo por estado.</p>
        <Button onClick={() => setEditing({ active: true, label: "Padrão" })}><Plus className="h-4 w-4" /> Novo frete</Button>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">UF</th>
              <th className="text-left px-4 py-3">Modalidade</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Prazo (dias)</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-bold">{s.state}</td>
                <td className="px-4 py-3">{s.label}</td>
                <td className="px-4 py-3 text-right font-semibold">R$ {Number(s.price).toFixed(2)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                  {s.delivery_days_min && s.delivery_days_max ? `${s.delivery_days_min}–${s.delivery_days_max}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {s.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)} className="p-1.5 hover:bg-muted rounded mr-1"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(s.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum frete cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="font-bold text-xl">{editing.id ? "Editar frete" : "Novo frete"}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>UF *</Label>
                <select required className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" value={editing.state || ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })}>
                  <option value="">—</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Modalidade</Label>
                <Input value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Padrão / Expresso" />
              </div>
              <div className="space-y-2"><Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" required value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </div>
              <div className="space-y-2 grid grid-cols-2 gap-2">
                <div><Label>Prazo mín.</Label><Input type="number" value={editing.delivery_days_min || ""} onChange={(e) => setEditing({ ...editing, delivery_days_min: e.target.value })} /></div>
                <div><Label>Prazo máx.</Label><Input type="number" value={editing.delivery_days_max || ""} onChange={(e) => setEditing({ ...editing, delivery_days_max: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Ativo</label>
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
