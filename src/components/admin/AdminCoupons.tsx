import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";

export function AdminCoupons() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const qc = useQueryClient();

  // Converte ISO UTC -> string "YYYY-MM-DDTHH:mm" no fuso local p/ datetime-local.
  function toLocalInput(iso: string | null | undefined) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
  }

  async function load() {
    setError(null);
    const { data, error: err } = await supabase.from("coupons" as any).select("*").order("created_at", { ascending: false });
    if (err) {
      const info = logSupabaseError("Carregar cupons", err, { table: "coupons" });
      setError(info);
      toast.error(`Cupons: ${info.message}`);
      return;
    }
    setItems((data as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const f = editing;
    const dt = (f.discount_type || "percent");
    const dv = Number(f.discount_value) || 0;
    if (dv <= 0) { toast.error("Valor de desconto deve ser > 0"); return; }
    if (dt === "percent" && dv > 100) { toast.error("Percentual máximo é 100%"); return; }
    if (!String(f.code || "").trim()) { toast.error("Código obrigatório"); return; }
    const payload: any = {
      code: (f.code || "").trim().toUpperCase(),
      description: f.description || null,
      discount_type: dt,
      discount_value: dv,
      min_subtotal: Number(f.min_subtotal) || 0,
      max_uses: f.max_uses ? Number(f.max_uses) : null,
      active: f.active !== false,
      // datetime-local devolve "YYYY-MM-DDTHH:mm" sem timezone — converter para
      // ISO garante que o Postgres interprete como timestamptz local do cliente.
      expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
    };
    const { error } = f.id
      ? await supabase.from("coupons" as any).update(payload).eq("id", f.id)
      : await supabase.from("coupons" as any).insert(payload);
    if (error) {
      logSupabaseError("Guardar cupom", error, { id: f.id, code: payload.code });
      toast.error(error.message);
    } else { toast.success("Cupom guardado"); setEditing(null); load(); }
    qc.invalidateQueries({ queryKey: ["coupons"] });
  }

  async function del(id: string) {
    if (!confirm("Remover cupom?")) return;
    const { error } = await supabase.from("coupons" as any).delete().eq("id", id);
    if (error) {
      logSupabaseError("Remover cupom", error, { id });
      toast.error(error.message);
    } else { toast.success("Removido"); load(); }
    qc.invalidateQueries({ queryKey: ["coupons"] });
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Crie códigos de desconto que os clientes aplicam no checkout.</p>
        <Button onClick={() => setEditing({ active: true, discount_type: "percent" })}><Plus className="h-4 w-4" /> Novo cupom</Button>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Desconto</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Mín. compra</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Usos</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                <td className="px-4 py-3">
                  {c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">R$ {Number(c.min_subtotal).toFixed(2)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-muted rounded mr-1"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(c.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum cupom cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="font-bold text-xl">{editing.id ? "Editar cupom" : "Novo cupom"}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2"><Label>Código *</Label>
                <Input required placeholder="BEMVINDO10" value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-2"><Label>Tipo</Label>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Valor *</Label>
                <Input type="number" step="0.01" required value={editing.discount_value || ""} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Mín. compra (R$)</Label>
                <Input type="number" step="0.01" value={editing.min_subtotal || ""} onChange={(e) => setEditing({ ...editing, min_subtotal: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Máx. usos</Label>
                <Input type="number" placeholder="ilimitado" value={editing.max_uses || ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label>
                <Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Expira em</Label>
                <Input type="datetime-local" value={toLocalInput(editing.expires_at)} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value || null })} />
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
