import { supabase } from "@/integrations/supabase/client";

/**
 * Log de ações administrativas. Imutável (RLS bloqueia UPDATE/DELETE).
 *
 * Uso:
 *   await logAdminAction({
 *     action: "update",
 *     entity: "products",
 *     entityId: product.id,
 *     summary: `Produto "${name}"`,
 *     diff: { before, after },
 *   });
 *
 * Não-bloqueante: falhas só são logadas no console — nunca derrubam a UI.
 */

export type AdminAction =
  | "create"
  | "update"
  | "delete"
  | "settings_save"
  | "status_change"
  | "affiliate.release_due"
  | "affiliate.mark_paid";

export type AdminEntity =
  | "products"
  | "categories"
  | "coupons"
  | "shipping_rates"
  | "site_banners"
  | "home_banners"
  | "site_settings"
  | "orders"
  | "resends"
  | "affiliate_commissions"
  | "user_roles";

export interface AdminLogInput {
  action: AdminAction;
  entity: AdminEntity;
  entityId?: string | null;
  summary?: string;
  diff?: unknown;
}

export async function logAdminAction(input: AdminLogInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const u = auth?.user;
    if (!u) return; // sem usuário, não tem como auditar (RLS bloquearia mesmo)

    const { error } = await (supabase as any).from("admin_audit_log").insert({
      user_id: u.id,
      user_email: u.email ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      diff: input.diff ?? null,
    });
    if (error) {
      console.warn("[auditLog] insert failed", error.message, input);
    }
  } catch (e) {
    console.warn("[auditLog] unexpected", e);
  }
}

/**
 * Calcula um diff superficial entre dois objetos. Devolve apenas as chaves
 * que mudaram, com {from, to} — útil pra deixar o registro enxuto.
 */
export function shallowDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    // ignora chaves técnicas e timestamps
    if (k === "id" || k === "created_at" || k === "updated_at") continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[k] = { from: a ?? null, to: b ?? null };
    }
  }
  return out;
}
