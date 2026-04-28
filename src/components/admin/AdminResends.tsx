import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { PackageCheck, Truck } from "lucide-react";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";

const STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "requested", label: "Solicitado" },
  { value: "in_preparation", label: "Em preparação" },
  { value: "sent", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
];

export function AdminResends() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  async function load() {
    setError(null);
    const base: any = supabase.from("orders").select("*");
    const q = filter === "pending"
      ? base.in("resend_status", ["requested", "in_preparation"])
      : base.not("resend_status", "is", null);
    const { data, error: err } = await q.order("resend_requested_at", { ascending: false, nullsFirst: false });
    if (err) {
      const info = logSupabaseError("Carregar reenvios", err, { filter });
      setError(info);
      toast.error(`Reenvios: ${info.message}`);
      return;
    }
    setItems((data as any[]) || []);
  }
  useEffect(() => { load(); }, [filter]);

  async function update(id: string, patch: any) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      logSupabaseError("Atualizar reenvio", error, { id, patch });
      toast.error(error.message);
    } else { toast.success("Atualizado"); load(); }
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Acompanhe pedidos com solicitação de reenvio.</p>
        <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="pending">Pendentes</option>
          <option value="all">Todos</option>
        </select>
      </div>
      <div className="space-y-3">
        {items.map((o) => (
          <div key={o.id} className="bg-card rounded-2xl border border-border p-4 md:p-5">
            <div className="flex flex-wrap justify-between gap-3 mb-3">
              <div>
                <p className="font-bold">#{o.id.slice(0,8)} — {o.shipping_full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Solicitado em {o.resend_requested_at ? new Date(o.resend_requested_at).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
              <span className="font-semibold">{formatBRL(o.total)}</span>
            </div>
            {o.resend_notes && <p className="text-sm bg-muted/40 rounded-lg p-3 mb-3">{o.resend_notes}</p>}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={o.resend_status || ""}
                onChange={(e) => update(o.id, { resend_status: e.target.value || null })}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {o.resend_status !== "sent" && (
                <Button size="sm" variant="outline" onClick={() => update(o.id, { resend_status: "sent", resend_sent_at: new Date().toISOString() })}>
                  <Truck className="h-4 w-4" /> Marcar enviado
                </Button>
              )}
              {o.resend_status === "sent" && (
                <Button size="sm" variant="outline" onClick={() => update(o.id, { resend_status: "delivered" })}>
                  <PackageCheck className="h-4 w-4" /> Marcar entregue
                </Button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">Nenhum reenvio.</div>}
      </div>
    </>
  );
}
