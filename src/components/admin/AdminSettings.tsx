import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { refreshSiteSettings } from "@/hooks/useSiteSettings";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { logAdminAction } from "@/lib/auditLog";

const FIELDS: { key: string; label: string; type: "text" | "textarea" | "toggle" | "number"; help?: string }[] = [
  { key: "checkout_enable_pix", label: "Aceitar PIX no checkout", type: "toggle" },
  { key: "checkout_enable_card", label: "Aceitar cartão de crédito", type: "toggle" },
  { key: "insurance_optional", label: "Seguro de envio é opcional (cliente escolhe)", type: "toggle", help: "Se desligado, o seguro de 10% é cobrado sempre." },
  { key: "whatsapp_number", label: "WhatsApp (com DDI, só números)", type: "text", help: "Ex.: 5511999999999" },
  { key: "whatsapp_message", label: "Mensagem padrão WhatsApp", type: "text" },
  { key: "hero_bio", label: "Bio do topo (quando não há banner)", type: "textarea" },
  { key: "badge_new_days", label: "Marcar produto como LANÇAMENTO até (dias)", type: "number" },
];

export function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  async function load() {
    setError(null);
    const { data, error: err } = await (supabase as any).from("site_settings").select("*");
    if (err) {
      const info = logSupabaseError("Carregar configurações", err, { table: "site_settings" });
      setError(info);
      toast.error(`Configurações: ${info.message}`);
      return;
    }
    const v: Record<string, string> = {};
    (data || []).forEach((r: any) => { v[r.key] = r.value ?? ""; });
    setValues(v);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const rows = FIELDS.map((f) => ({ key: f.key, value: values[f.key] ?? "" }));
      const { error } = await (supabase as any).from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      await refreshSiteSettings();
      toast.success("Configurações guardadas");
      logAdminAction({
        action: "settings_save",
        entity: "site_settings",
        summary: `Configurações atualizadas (${rows.length} chaves)`,
        diff: { after: Object.fromEntries(rows.map((r) => [r.key, r.value])) },
      });
    } catch (e: any) {
      logSupabaseError("Guardar configurações", e);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="font-bold text-lg">Configurações do site</h2>
        <p className="text-xs text-muted-foreground">Mudanças se aplicam imediatamente para todos os clientes.</p>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-2">
          {f.type === "toggle" ? (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={values[f.key] === "1"}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.checked ? "1" : "0" })}
              />
              <div>
                <span className="font-medium text-sm">{f.label}</span>
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
            </label>
          ) : f.type === "textarea" ? (
            <>
              <Label>{f.label}</Label>
              <textarea
                className="w-full min-h-[80px] rounded-xl border border-input bg-background p-3 text-sm"
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </>
          ) : (
            <>
              <Label>{f.label}</Label>
              <Input
                type={f.type === "number" ? "number" : "text"}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </>
          )}
        </div>
      ))}
      <div className="pt-4 border-t border-border">
        <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar configurações"}</Button>
      </div>
    </div>
  );
}
