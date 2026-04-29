import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, ShoppingCart, CreditCard, CheckCircle2, TrendingDown, Loader2, Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

interface Summary {
  views: number;
  unique_viewers: number;
  wishlist_adds: number;
  cart_adds: number;
  checkout_started: number;
  orders_paid: number;
  orders_total: number;
  revenue_paid: number;
}

interface ByProduct {
  product_id: string;
  product_name: string;
  product_slug: string;
  views: number;
  wishlist_adds: number;
  cart_adds: number;
  units_paid: number;
  view_to_cart: number;
  cart_to_paid: number;
}

const PERIODS = [
  { id: 7, label: "7 dias" },
  { id: 30, label: "30 dias" },
  { id: 90, label: "90 dias" },
] as const;

function pct(n: number): string {
  if (!isFinite(n) || n <= 0) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

function ratio(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  return num / den;
}

/**
 * Painel de funil de conversão.
 * Mostra Views → Favoritos → Carrinho → Checkout iniciado → Pagos
 * com taxas de drop-off entre etapas e ranking de produtos por conversão.
 */
export function AdminFunnel() {
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byProduct, setByProduct] = useState<ByProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [days]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const [s, p] = await Promise.all([
        (supabase as any).rpc("funnel_summary", { p_start: range.start, p_end: range.end }),
        (supabase as any).rpc("funnel_by_product", { p_start: range.start, p_end: range.end, p_limit: 25 }),
      ]);
      if (cancel) return;
      if (s.error) {
        toast.error("Erro ao carregar funil", { description: s.error.message });
        setLoading(false);
        return;
      }
      // RPC `RETURNS TABLE` devolve array com 1 linha
      const row = Array.isArray(s.data) ? s.data[0] : s.data;
      setSummary(
        row
          ? {
              views: Number(row.views || 0),
              unique_viewers: Number(row.unique_viewers || 0),
              wishlist_adds: Number(row.wishlist_adds || 0),
              cart_adds: Number(row.cart_adds || 0),
              checkout_started: Number(row.checkout_started || 0),
              orders_paid: Number(row.orders_paid || 0),
              orders_total: Number(row.orders_total || 0),
              revenue_paid: Number(row.revenue_paid || 0),
            }
          : null,
      );
      setByProduct(((p.data as ByProduct[]) || []).map((r) => ({
        ...r,
        views: Number(r.views || 0),
        wishlist_adds: Number(r.wishlist_adds || 0),
        cart_adds: Number(r.cart_adds || 0),
        units_paid: Number(r.units_paid || 0),
        view_to_cart: Number(r.view_to_cart || 0),
        cart_to_paid: Number(r.cart_to_paid || 0),
      })));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [range.start, range.end]);

  const stages = useMemo(() => {
    const s = summary;
    if (!s) return [];
    return [
      { key: "views",    label: "Visualizações",    value: s.views,            icon: Eye,           color: "bg-blue-500" },
      { key: "wishlist", label: "Favoritos",        value: s.wishlist_adds,    icon: Heart,         color: "bg-pink-500" },
      { key: "cart",     label: "Adições ao carrinho", value: s.cart_adds,     icon: ShoppingCart,  color: "bg-amber-500" },
      { key: "checkout", label: "Checkout iniciado", value: s.checkout_started, icon: CreditCard,    color: "bg-violet-500" },
      { key: "paid",     label: "Pedidos pagos",    value: s.orders_paid,      icon: CheckCircle2,  color: "bg-emerald-500" },
    ];
  }, [summary]);

  const overallConversion = summary ? ratio(summary.orders_paid, summary.views) : 0;
  const aov = summary && summary.orders_paid > 0 ? summary.revenue_paid / summary.orders_paid : 0;

  return (
    <section className="space-y-6">
      {/* Header + filtro de período */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-primary">Funil de conversão</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Últimos {days} dias
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border p-1 bg-muted/30">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setDays(p.id)}
              className={`px-4 h-9 text-xs font-semibold rounded-full transition-colors ${
                days === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
          Carregando métricas…
        </div>
      ) : !summary ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhum dado no período.
        </div>
      ) : (
        <>
          {/* KPIs no topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Visitantes únicos" value={summary.unique_viewers.toLocaleString("pt-BR")} hint={`${summary.views.toLocaleString("pt-BR")} visualizações`} />
            <KpiCard label="Pedidos pagos" value={summary.orders_paid.toLocaleString("pt-BR")} hint={`${summary.orders_total} total`} />
            <KpiCard label="Receita paga" value={formatBRL(summary.revenue_paid)} hint={`Ticket médio ${formatBRL(aov)}`} />
            <KpiCard label="Conversão geral" value={pct(overallConversion)} hint="Visitas → pagas" highlight />
          </div>

          {/* Funil visual */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h3 className="font-bold text-base mb-1">Etapas do funil</h3>
            <p className="text-xs text-muted-foreground mb-5">Drop-off entre cada etapa do período selecionado.</p>
            <ul className="space-y-3">
              {stages.map((s, i) => {
                const top = stages[0].value || 1;
                const widthPct = Math.max(4, (s.value / top) * 100);
                const prev = i > 0 ? stages[i - 1] : null;
                const stepConv = prev ? ratio(s.value, prev.value) : 1;
                const dropPct = prev ? Math.max(0, 1 - stepConv) : 0;
                return (
                  <li key={s.key}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <s.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{s.label}</span>
                        {prev && (
                          <span className="text-[11px] text-muted-foreground">
                            · {pct(stepConv)} da etapa anterior
                          </span>
                        )}
                      </div>
                      <span className="font-bold tabular-nums">{s.value.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="relative h-7 rounded-lg bg-muted overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${s.color} opacity-90 transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    {prev && dropPct > 0.1 && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <TrendingDown className="h-3 w-3" />
                        {pct(dropPct)} abandona aqui ({(prev.value - s.value).toLocaleString("pt-BR")} pessoas)
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Breakdown por produto */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <header className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-base">Onde mais perdemos vendas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Produtos com muitas visualizações e baixa conversão para carrinho ou pagamento.
              </p>
            </header>
            {byProduct.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum produto com atividade no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Produto</th>
                      <th className="text-right px-4 py-3">Views</th>
                      <th className="text-right px-4 py-3 hidden md:table-cell">Favoritos</th>
                      <th className="text-right px-4 py-3">Carrinho</th>
                      <th className="text-right px-4 py-3">Pagas</th>
                      <th className="text-right px-4 py-3">View → Cart</th>
                      <th className="text-right px-4 py-3">Cart → Paid</th>
                      <th className="px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.map((r) => {
                      const lowVtc = r.views >= 10 && r.view_to_cart < 0.05;
                      const lowCtp = r.cart_adds >= 5 && r.cart_to_paid < 0.2;
                      return (
                        <tr key={r.product_id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium truncate max-w-[260px]">{r.product_name}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{r.views.toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">{r.wishlist_adds}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{r.cart_adds}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{r.units_paid}</td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowVtc ? "text-destructive" : ""}`}>
                            {pct(r.view_to_cart)}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowCtp ? "text-destructive" : ""}`}>
                            {pct(r.cart_to_paid)}
                          </td>
                          <td className="px-2 py-3">
                            <Link
                              to={`/produto/${r.product_slug}`}
                              target="_blank"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              aria-label={`Ver ${r.product_name}`}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
              Linhas em vermelho indicam pontos críticos (View→Cart &lt; 5% com 10+ views, ou Cart→Paid &lt; 20% com 5+ carrinhos).
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function KpiCard({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="font-display text-2xl md:text-[1.6rem] font-extrabold tabular-nums leading-tight mt-1">
        {value}
      </p>
      {hint && (
        <p className={`text-[11px] mt-1 ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}