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

type FieldGroup = "brand" | "checkout" | "support" | "catalog";

const FIELDS: { key: string; label: string; type: "text" | "textarea" | "toggle" | "number"; help?: string; group: FieldGroup }[] = [
  // === Identidade da marca (aparece no footer, declarações de envio, e-mails) ===
  { key: "brand_name",     label: "Nome da marca",                    type: "text",     group: "brand", help: "Aparece no footer, declarações de envio e e-mails de pedido." },
  { key: "brand_cnpj",     label: "CNPJ",                             type: "text",     group: "brand", help: "Exigido pelo CDC — exibido no rodapé." },
  { key: "brand_email",    label: "E-mail de contato",                type: "text",     group: "brand", help: "Aparece na declaração de envio. Ex.: contato@minhaloja.com.br" },
  { key: "brand_address",  label: "Endereço completo",                type: "textarea", group: "brand", help: "Rua, número, bairro, cidade/UF, CEP." },
  { key: "business_hours", label: "Horário de atendimento",           type: "text",     group: "brand", help: "Ex.: Seg–Sex 9h às 18h. Aparece no footer." },
  // === Checkout ===
  { key: "checkout_enable_pix",  label: "Aceitar PIX no checkout",       type: "toggle",  group: "checkout" },
  { key: "checkout_enable_card", label: "Aceitar cartão de crédito",     type: "toggle",  group: "checkout" },
  { key: "insurance_optional",   label: "Seguro de envio é opcional",    type: "toggle",  group: "checkout", help: "Se desligado, o seguro de 10% é cobrado sempre." },
  // === Suporte ===
  { key: "whatsapp_number",  label: "WhatsApp (com DDI, só números)", type: "text",     group: "support", help: "Ex.: 5511999999999" },
  { key: "whatsapp_message", label: "Mensagem padrão WhatsApp",       type: "text",     group: "support" },
  // === Catálogo ===
  { key: "badge_new_days",    label: "Marcar produto como LANÇAMENTO até (dias)", type: "number", group: "catalog" },
  { key: "welcome_coupon",    label: "Cupom de boas-vindas",                      type: "text",   group: "catalog", help: "Exibido no popup de 1ª compra. Deixe em branco para desativar o popup." },
];

const GROUP_LABELS: Record<FieldGroup, string> = {
  brand: "Identidade da marca",
  checkout: "Checkout",
  support: "Suporte ao cliente",
  catalog: "Catálogo",
};

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

  // Agrupa campos por seção para facilitar leitura do admin (antes era
  // uma lista plana de 5 itens; agora são ~10 campos, precisa de seções).
  const groupedFields = (Object.keys(GROUP_LABELS) as FieldGroup[]).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    fields: FIELDS.filter((f) => f.group === g),
  }));

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 max-w-2xl">
      <div className="mb-5 pb-4 border-b border-border">
        <h2 className="font-bold text-lg">Configurações do site</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Mudanças se aplicam imediatamente para todos os clientes.</p>
      </div>
      <div className="space-y-8">
        {groupedFields.map((g) => (
          <section key={g.group} className="space-y-4">
            <h3 className="text-2xs font-bold uppercase tracking-[0.14em] text-primary/80">{g.label}</h3>
            {g.fields.map((f) => (
              <div key={f.key} className="space-y-2">
                {f.type === "toggle" ? (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={values[f.key] === "1"}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.checked ? "1" : "0" })}
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{f.label}</span>
                      {f.help && <p className="text-xs text-muted-foreground mt-0.5">{f.help}</p>}
                    </div>
                  </label>
                ) : f.type === "textarea" ? (
                  <>
                    <Label>{f.label}</Label>
                    <textarea
                      className="w-full min-h-[80px] rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all scrollbar-thin"
                      value={values[f.key] || ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                    {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
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
          </section>
        ))}
      </div>
      <div className="pt-5 mt-6 border-t border-border">
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</Button>
      </div>
    </div>
  );
}
