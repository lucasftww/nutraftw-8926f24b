import { AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";

export type AdminErrorInfo = {
  /** Curto rótulo do que falhou, ex: "Carregar pedidos" */
  scope: string;
  /** Mensagem principal (vinda de error.message) */
  message: string;
  /** Código do PostgREST/Supabase, se houver */
  code?: string | null;
  /** Detalhes/hint do erro */
  details?: string | null;
  hint?: string | null;
  /** Timestamp ISO */
  at?: string;
};

/**
 * Loga um erro do Supabase no console com contexto rico e devolve um AdminErrorInfo
 * pronto para alimentar o <AdminErrorBanner />. Centralizado para padronizar o debug.
 */
export function logSupabaseError(scope: string, error: any, extra?: Record<string, any>): AdminErrorInfo {
  const info: AdminErrorInfo = {
    scope,
    message: error?.message || String(error) || "Erro desconhecido",
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    at: new Date().toISOString(),
  };
  // Console em grupo para inspeção rápida no DevTools
  // eslint-disable-next-line no-console
  console.group(`%c[admin] ${scope} falhou`, "color:#dc2626;font-weight:bold");
  // eslint-disable-next-line no-console
  console.error("message:", info.message);
  if (info.code) console.error("code:", info.code);
  if (info.details) console.error("details:", info.details);
  if (info.hint) console.error("hint:", info.hint);
  if (extra) console.error("context:", extra);
  console.error("raw:", error);
  console.groupEnd();
  return info;
}

export function AdminErrorBanner({
  error,
  onRetry,
}: {
  error: AdminErrorInfo;
  onRetry?: () => void;
}) {
  function copy() {
    const blob = JSON.stringify(error, null, 2);
    navigator.clipboard?.writeText(blob).then(
      () => toast.success("Detalhes copiados"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 md:p-5 space-y-2"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-destructive">{error.scope} — falha ao carregar</p>
          <p className="text-sm text-foreground mt-0.5 break-words">{error.message}</p>
          {(error.code || error.details || error.hint) && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {error.code && (
                <>
                  <dt className="font-semibold">code</dt>
                  <dd className="font-mono break-all">{error.code}</dd>
                </>
              )}
              {error.details && (
                <>
                  <dt className="font-semibold">details</dt>
                  <dd className="break-words">{error.details}</dd>
                </>
              )}
              {error.hint && (
                <>
                  <dt className="font-semibold">hint</dt>
                  <dd className="break-words">{error.hint}</dd>
                </>
              )}
              {error.at && (
                <>
                  <dt className="font-semibold">at</dt>
                  <dd className="font-mono">{error.at}</dd>
                </>
              )}
            </dl>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-accent transition-colors"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground border-t border-destructive/20 pt-2">
        Detalhes completos foram impressos no console do navegador (DevTools → Console).
      </p>
    </div>
  );
}