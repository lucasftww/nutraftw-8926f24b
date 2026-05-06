import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { logSupabaseError } from "@/components/admin/AdminErrorBanner";

/**
 * Auditoria contínua de updates do admin.
 *
 * Após um UPDATE retornar sucesso, relê o registro do banco e compara os
 * campos do payload com o que ficou persistido. Se algum campo divergir
 * (ex.: trigger reverteu, RLS bloqueou silenciosamente, race com outro
 * admin), registra `divergence_detected` no log imutável.
 *
 * Se o próprio UPDATE falhar, registra `update_failed` com o erro.
 *
 * Não-bloqueante: nunca lança. Sempre devolve { ok, divergedKeys }.
 */
export interface IntegrityCheckArgs {
  table: string;
  id: string;
  payload: Record<string, any>;
  /** Entidade do log (admin_audit_log.entity). Default = table. */
  entity?: string;
  /** Resumo curto pra UI do log. */
  summary?: string;
  /** Erro do .update(), se houve. */
  error?: any;
}

export interface IntegrityResult {
  ok: boolean;
  divergedKeys: string[];
}

const IGNORE_KEYS = new Set(["updated_at", "created_at"]);

function eq(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  // Normaliza números (Postgres pode devolver string em alguns casos)
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }
  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) === Boolean(b);
  }
  // Strings com espaços extras
  if (typeof a === "string" && typeof b === "string") {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function auditUpdateIntegrity(args: IntegrityCheckArgs): Promise<IntegrityResult> {
  const entity = (args.entity || args.table) as any;

  // Caso 1: UPDATE falhou — loga e sai.
  if (args.error) {
    logSupabaseError(`Update ${args.table} falhou`, args.error, { id: args.id });
    try {
      await logAdminAction({
        action: "update_failed",
        entity,
        entityId: args.id,
        summary: args.summary || `Falha ao atualizar ${args.table}`,
        diff: {
          payload: args.payload,
          error: {
            message: args.error?.message,
            code: args.error?.code,
            details: args.error?.details,
            hint: args.error?.hint,
          },
        },
      });
    } catch {/* swallow */}
    return { ok: false, divergedKeys: [] };
  }

  // Caso 2: UPDATE ok — relê e compara.
  try {
    const keys = Object.keys(args.payload).filter((k) => !IGNORE_KEYS.has(k));
    if (keys.length === 0) return { ok: true, divergedKeys: [] };

    const { data, error } = await (supabase as any)
      .from(args.table)
      .select(keys.join(", "))
      .eq("id", args.id)
      .maybeSingle();

    if (error || !data) {
      // Não conseguimos reler — não dá pra afirmar divergência. Loga aviso só no console.
      console.warn("[integrityAudit] re-read falhou", args.table, args.id, error?.message);
      return { ok: true, divergedKeys: [] };
    }

    const diverged: Record<string, { expected: unknown; actual: unknown }> = {};
    for (const k of keys) {
      if (!eq((args.payload as any)[k], (data as any)[k])) {
        diverged[k] = { expected: (args.payload as any)[k], actual: (data as any)[k] };
      }
    }
    const divergedKeys = Object.keys(diverged);
    if (divergedKeys.length === 0) return { ok: true, divergedKeys: [] };

    console.group(`%c[integrityAudit] divergência em ${args.table}#${args.id}`, "color:#dc2626;font-weight:bold");
    console.warn("campos divergentes:", divergedKeys);
    console.warn("detalhe:", diverged);
    console.groupEnd();

    try {
      await logAdminAction({
        action: "divergence_detected",
        entity,
        entityId: args.id,
        summary: args.summary
          ? `Divergência após salvar ${args.summary} (${divergedKeys.join(", ")})`
          : `Divergência detectada em ${args.table} (${divergedKeys.join(", ")})`,
        diff: diverged,
      });
    } catch {/* swallow */}
    return { ok: false, divergedKeys };
  } catch (e) {
    console.warn("[integrityAudit] erro inesperado", e);
    return { ok: true, divergedKeys: [] };
  }
}
