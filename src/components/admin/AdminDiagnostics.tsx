import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { refreshSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Diagnóstico de sincronização de cache.
 *
 * Para cada entidade comparamos:
 *   - dbCount   = COUNT(*) real no Supabase (head:true, sem payload)
 *   - cacheCount = nº de registros que está no cache do react-query (ou na store custom)
 *
 * Se diferentes ⇒ a tela do site/admin que consome esse cache está desatualizada.
 * Botões permitem forçar invalidação por entidade ou de tudo.
 */

type EntityKey = "products" | "categories" | "coupons" | "shipping" | "settings";

type Row = {
  key: EntityKey;
  label: string;
  table: string;
  /** Lê o tamanho atual do cache visível ao site (ou null se não há cache em memória) */
  readCache: () => number | null;
  /** Invalida todas as queries relacionadas */
  invalidate: () => Promise<void> | void;
};

export function AdminDiagnostics() {
  const qc = useQueryClient();
  const [counts, setCounts] = useState<Record<EntityKey, { db: number | null; cache: number | null }>>({
    products: { db: null, cache: null },
    categories: { db: null, cache: null },
    coupons: { db: null, cache: null },
    shipping: { db: null, cache: null },
    settings: { db: null, cache: null },
  });
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // Lê tamanho do cache visível ao site, considerando query keys ativas.
  const readReactQueryCount = useCallback(
    (queryKey: readonly unknown[]): number | null => {
      // Procura QUALQUER query no cache cujo key começa com queryKey (prefix match).
      const queries = qc.getQueryCache().findAll({ queryKey, exact: false });
      if (queries.length === 0) return null;
      // Pega a query com dado mais "fresco" (último updatedAt) que retorne array
      let best: number | null = null;
      let bestTs = -1;
      for (const q of queries) {
        const data = q.state.data as unknown;
        const ts = q.state.dataUpdatedAt;
        if (Array.isArray(data) && ts > bestTs) {
          best = data.length;
          bestTs = ts;
        }
      }
      return best;
    },
    [qc],
  );

  const rows: Row[] = [
    {
      key: "products",
      label: "Produtos",
      table: "products",
      readCache: () => readReactQueryCount(queryKeys.products.active),
      invalidate: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.products.all });
        await qc.invalidateQueries({ queryKey: queryKeys.products.detailRoot });
      },
    },
    {
      key: "categories",
      label: "Categorias",
      table: "categories",
      readCache: () => readReactQueryCount(queryKeys.categories.all),
      invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.categories.all }),
    },
    {
      key: "coupons",
      label: "Cupons (ativos)",
      table: "coupons",
      readCache: () => readReactQueryCount(queryKeys.coupons.all),
      invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.coupons.all }),
    },
    {
      key: "shipping",
      label: "Fretes (ativos)",
      table: "shipping_rates",
      readCache: () => readReactQueryCount(queryKeys.shippingRates.all),
      invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.shippingRates.all }),
    },
    {
      key: "settings",
      label: "Configurações do site",
      table: "site_settings",
      readCache: () => null, // store custom — não comparável diretamente
      invalidate: () => refreshSiteSettings().then(() => undefined),
    },
  ];

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const next: typeof counts = { ...counts };
      await Promise.all(
        rows.map(async (r) => {
          const q = (supabase as any).from(r.table).select("id", { count: "exact", head: true });
          // Para coupons/shipping interessa "ativos" — alinha com o que o site consome.
          if (r.key === "products") q.eq("is_active", true);
          if (r.key === "coupons" || r.key === "shipping") q.eq("active", true);
          const { count, error } = await q;
          if (error) {
            console.error("[diagnostics]", r.key, error);
            next[r.key] = { db: null, cache: r.readCache() };
            return;
          }
          next[r.key] = { db: count ?? 0, cache: r.readCache() };
        }),
      );
      setCounts(next);
      setLastCheck(new Date());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  useEffect(() => { check(); /* eslint-disable-next-line */ }, []);

  async function invalidateAll() {
    await Promise.all(rows.map((r) => r.invalidate()));
    toast.success("Cache invalidado em todas as telas");
    await check();
  }

  async function invalidateOne(r: Row) {
    await r.invalidate();
    toast.success(`Cache de ${r.label} invalidado`);
    await check();
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-lg">Diagnóstico de sincronização</h2>
            <p className="text-xs text-muted-foreground">
              Compara o número real no banco com o que está em cache no navegador. Se divergirem,
              o site mostra dados antigos até refrescar.
            </p>
            {lastCheck && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={check} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar agora
            </Button>
            <Button onClick={invalidateAll} disabled={loading}>Forçar refresh global</Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Entidade</th>
              <th className="text-right px-4 py-3">No banco</th>
              <th className="text-right px-4 py-3">No cache</th>
              <th className="text-center px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = counts[r.key];
              const sync = c.cache == null ? "unknown" : c.db === c.cache ? "ok" : "stale";
              return (
                <tr key={r.key} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.db ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {c.cache ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sync === "ok" && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> sincronizado
                      </span>
                    )}
                    {sync === "stale" && (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> desatualizado
                      </span>
                    )}
                    {sync === "unknown" && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => invalidateOne(r)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Invalidar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p><strong>Como interpretar:</strong></p>
        <p>• <strong>"—" no cache</strong>: a tela que consome esse dado ainda não foi aberta nesta sessão (não há cache).</p>
        <p>• <strong>Cupons / Fretes</strong>: o checkout busca on-demand a cada acesso, não usa cache react-query — divergência aqui só apareceria em telas futuras.</p>
        <p>• <strong>Configurações</strong>: usam store própria, sempre revalidada após salvar (não é comparável por contagem).</p>
      </div>
    </div>
  );
}
