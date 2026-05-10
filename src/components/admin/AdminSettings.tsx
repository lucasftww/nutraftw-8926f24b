import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { refreshSiteSettings } from "@/hooks/useSiteSettings";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyErrorMessage } from "@/lib/friendlyError";

const FIELDS: { key: string; label: string; type: "text" | "textarea" | "toggle" | "number"; help?: string }[] = [
  { key: "checkout_enable_pix", label: "Aceitar PIX no checkout", type: "toggle" },
  { key: "checkout_enable_card", label: "Aceitar cartão de crédito", type: "toggle" },
  { key: "insurance_optional", label: "Seguro de envio é opcional (cliente escolhe)", type: "toggle", help: "Se desligado, o seguro de 10% é cobrado sempre." },
  { key: "whatsapp_number", label: "WhatsApp (com DDI, só números)", type: "text", help: "Ex.: 5511999999999" },
  { key: "whatsapp_message", label: "Mensagem padrão WhatsApp", type: "text" },
  { key: "badge_new_days", label: "Marcar produto como LANÇAMENTO até (dias)", type: "number" },
];

export function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  async function load() {
    setError(null);
    const { data, error: err } = await (supabase as any).from("site_settings").select("*");
    if (err) {
      const info = logSupabaseError("Carregar configurações", err, { table: "site_settings" });
      setError(info);
      toast.error(`Configurações: ${info.message}`);
      setLoading(false);
      return;
    }
    const v: Record<string, string> = {};
    (data || []).forEach((r: any) => { v[r.key] = r.value ?? ""; });
    setValues(v);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    // Validação antes de persistir.
    const badgeDays = Number(values["badge_new_days"]);
    if (values["badge_new_days"] !== "" && (!Number.isInteger(badgeDays) || badgeDays < 1 || badgeDays > 365)) {
      toast.error("'Dias para lançamento' deve ser um inteiro entre 1 e 365.");
      return;
    }
    const wa = (values["whatsapp_number"] || "").replace(/\D/g, "");
    if (wa && (wa.length < 10 || wa.length > 15)) {
      toast.error("Número WhatsApp inválido. Use DDI + DDD + número (ex: 5511999999999).");
      return;
    }
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
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  if (loading) return (
    <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl space-y-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 bg-muted/50 rounded-xl animate-pulse" />
      ))}
    </div>
  );

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
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</Button>
      </div>
    </div>
  );
}
