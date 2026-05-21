import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, ShoppingCart, CreditCard, CheckCircle2, TrendingDown, Loader2, Calendar, ArrowRight, Users, ShoppingBag, DollarSign, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";

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
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d",  label: "7 dias",  hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
  { id: "90d", label: "90 dias", hours: 24 * 90 },
] as const;
type PeriodId = typeof PERIODS[number]["id"];

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
  const [periodId, setPeriodId] = useState<PeriodId>("24h");
  const period = PERIODS.find((p) => p.id === periodId)!;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byProduct, setByProduct] = useState<ByProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - period.hours * 3600 * 1000);
    // Para janelas em dias, alinhar ao início do dia para incluir a coorte completa.
    if (period.hours >= 24 * 7) start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [period.hours]);

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
        toast.error("Erro ao carregar funil", { description: friendlyErrorMessage(s.error) });
        setLoading(false);
        return;
      }
      // Erro silencioso no segundo RPC deixava o painel parecendo "sem
      // produtos" quando na verdade `funnel_by_product` falhou (ex.:
      // timeout). Avisar é melhor que esconder.
      if (p.error) {
        toast.error("Funil por produto", { description: friendlyErrorMessage(p.error) });
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
    // Paleta degradê: ciano (topo de funil, descoberta) → primary → secondary
    // (intenção) → success (conversão). Cada etapa tem cor própria pra
    // facilitar leitura visual rápida.
    return [
      { key: "views",    label: "Visualizações",       value: s.views,            icon: Eye,          gradient: "from-brand-cyan/50 to-brand-cyan",  accent: "text-brand-cyan-text" },
      { key: "wishlist", label: "Favoritos",           value: s.wishlist_adds,    icon: Heart,        gradient: "from-brand-cyan to-primary",        accent: "text-brand-cyan-text" },
      { key: "cart",     label: "Adições ao carrinho", value: s.cart_adds,        icon: ShoppingCart, gradient: "from-primary to-primary-glow",      accent: "text-primary" },
      { key: "checkout", label: "Checkout iniciado",   value: s.checkout_started, icon: CreditCard,   gradient: "from-secondary to-secondary-glow",  accent: "text-secondary" },
      { key: "paid",     label: "Pedidos pagos",       value: s.orders_paid,      icon: CheckCircle2, gradient: "from-success/70 to-success",        accent: "text-success" },
    ];
  }, [summary]);

  const overallConversion = summary ? ratio(summary.orders_paid, summary.views) : 0;
  const aov = summary && summary.orders_paid > 0 ? summary.revenue_paid / summary.orders_paid : 0;

  return (
    <section className="space-y-6">
      {/* Header + filtro de período */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-primary inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-brand-cyan text-primary-foreground shadow-elegant">
              <TrendingDown className="h-4 w-4 rotate-180" />
            </span>
            Funil de conversão
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {period.id === "24h" ? "Últimas 24 horas" : `Últimos ${period.hours / 24} dias`}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border p-1 bg-muted/30 w-full sm:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodId(p.id)}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 h-9 text-xs font-semibold rounded-full transition-colors ${
                periodId === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
          Carregando métricas…
        </div>
      ) : !summary ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyStateInline />
        </div>
      ) : (
        <>
          {/* KPIs no topo — cada card com sua cor */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Visitantes únicos"
              value={summary.unique_viewers.toLocaleString("pt-BR")}
              hint={`${summary.views.toLocaleString("pt-BR")} visualizações`}
              icon={Users}
              tone="cyan"
            />
            <KpiCard
              label="Pedidos pagos"
              value={summary.orders_paid.toLocaleString("pt-BR")}
              hint={`${summary.orders_total} total`}
              icon={ShoppingBag}
              tone="primary"
            />
            <KpiCard
              label="Receita paga"
              value={formatBRL(summary.revenue_paid)}
              hint={`Ticket médio ${formatBRL(aov)}`}
              icon={DollarSign}
              tone="success"
            />
            <KpiCard
              label="Conversão geral"
              value={pct(overallConversion)}
              hint="Visitas → pagas"
              icon={Sparkles}
              tone="secondary"
              highlight
            />
          </div>

          {/* Funil visual redesenhado: cards conectados com fluxo de drop */}
          <FunnelFlow stages={stages} overallConversion={overallConversion} />

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
                <table className="w-full text-sm min-w-[720px]">
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
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowVtc ? "text-warning" : ""}`}>
                            {pct(r.view_to_cart)}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowCtp ? "text-warning" : ""}`}>
                            {pct(r.cart_to_paid)}
                          </td>
                          <td className="px-2 py-3">
                            <Link
                              to={`/produto/${r.product_slug}`}
                              target="_blank"
                              rel="noreferrer"
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
            <p className="px-5 py-3 text-2xs text-muted-foreground border-t border-border bg-muted/20">
              Em <span className="text-warning font-medium">âmbar</span>: pontos com baixa conversão (View→Cart &lt; 5% com 10+ views, ou Cart→Paid &lt; 20% com 5+ carrinhos).
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function EmptyStateInline() {
  return (
    <div className="py-16 px-6 text-center">
      <p className="font-semibold text-sm">Sem dados no período</p>
      <p className="text-xs text-muted-foreground mt-1.5">
        Altere o período acima ou aguarde novos eventos para ver o funil.
      </p>
    </div>
  );
}

/**
 * Funil de conversão redesenhado.
 *
 * Layout:
 *  - Header com título e badge de conversão ponta-a-ponta.
 *  - Lista vertical de "stage cards" cada um com:
 *      • Ícone com gradiente da etapa
 *      • Label + número grande do volume
 *      • Barra de progresso proporcional ao topo do funil
 *      • Conversão vs etapa anterior + drop-off em destaque (âmbar)
 *  - Conector animado entre cards mostra o "fluxo" de drop.
 */
function FunnelFlow({
  stages,
  overallConversion,
}: {
  stages: Array<{ key: string; label: string; value: number; gradient: string; icon: any }>;
  overallConversion: number;
}) {
  const top = stages[0]?.value || 1;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-5 md:p-7 shadow-card">
      {/* Glow decorativo de fundo */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand-cyan/10 blur-3xl" />

      <header className="relative mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg md:text-xl font-extrabold tracking-tight text-foreground">
            Etapas do funil
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Volume real, conversão entre etapas e pontos de abandono.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary via-primary-glow to-brand-cyan px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-elegant">
          <Sparkles className="h-3.5 w-3.5" />
          {pct(overallConversion)} ponta-a-ponta
        </span>
      </header>

      <ol className="relative space-y-3">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1] : null;
          const stepConv = prev ? ratio(s.value, prev.value) : 1;
          const dropPct = prev ? Math.max(0, 1 - stepConv) : 0;
          const dropAbs = prev ? Math.max(0, prev.value - s.value) : 0;
          const showDrop = !!prev && dropPct > 0.3 && dropAbs >= 5;
          const widthPct = top > 0 ? Math.max(4, (s.value / top) * 100) : 4;
          const Icon = s.icon;
          const isLast = i === stages.length - 1;
          return (
            <li key={s.key} className="relative">
              {/* Conector vertical até o próximo card */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[26px] top-full z-0 h-3 w-px bg-gradient-to-b from-border to-transparent"
                />
              )}

              <div className="relative z-10 flex items-stretch gap-3 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-3.5 md:p-4 hover:border-primary/40 hover:shadow-soft transition-all">
                {/* Ícone numerado */}
                <div className="relative shrink-0">
                  <span
                    className={`relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} text-white shadow-lg`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-2xs font-bold tabular-nums text-foreground">
                    {i + 1}
                  </span>
                </div>

                {/* Label + barra + valor */}
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-2xs uppercase tracking-[0.14em] font-semibold text-muted-foreground truncate">
                      {s.label}
                    </p>
                    <p className="font-display text-xl md:text-2xl font-extrabold tabular-nums leading-none text-foreground">
                      {s.value.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.gradient} shadow-[0_0_12px_-2px_currentColor] transition-[width] duration-700 ease-out`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>

                {/* Conversão vs etapa anterior */}
                <div className="hidden sm:flex flex-col items-end justify-center min-w-[88px] shrink-0 pl-2 border-l border-border/60">
                  {prev ? (
                    <>
                      <p className="text-2xs uppercase tracking-wider text-muted-foreground leading-none">
                        Conversão
                      </p>
                      <p
                        className={`font-display font-extrabold text-lg tabular-nums leading-tight mt-1 ${
                          showDrop ? "text-warning" : "text-foreground"
                        }`}
                      >
                        {pct(stepConv)}
                      </p>
                      {showDrop && (
                        <p className="inline-flex items-center gap-1 text-2xs font-semibold text-warning mt-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          −{dropAbs.toLocaleString("pt-BR")}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-2xs font-bold uppercase tracking-wider">
                      Topo
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile: conversão abaixo do card */}
              {prev && (
                <div className="sm:hidden flex items-center justify-between mt-1 px-3.5 text-2xs">
                  <span className="text-muted-foreground">Conversão da etapa</span>
                  <span className={`font-bold tabular-nums ${showDrop ? "text-warning" : "text-foreground"}`}>
                    {pct(stepConv)}
                    {showDrop && <span className="ml-1 opacity-80">(−{dropAbs.toLocaleString("pt-BR")})</span>}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="relative mt-6 pt-4 border-t border-border/60 text-2xs text-muted-foreground/80 leading-relaxed">
        Etapas vêm de origens diferentes (analytics × pedidos). Foque na tendência relativa, não no número absoluto.
      </p>
    </div>
  );
}

type KpiTone = "cyan" | "primary" | "success" | "secondary";

function KpiCard({
  label, value, hint, icon: Icon, tone, highlight,
}: {
  label: string; value: string; hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: KpiTone; highlight?: boolean;
}) {
  // Tom = ícone + barra lateral colorida; o card em si é claro p/ legibilidade.
  const toneMap: Record<KpiTone, { bar: string; iconBg: string; iconFg: string }> = {
    cyan:      { bar: "bg-gradient-to-b from-brand-cyan to-primary",         iconBg: "bg-brand-cyan/15 ring-1 ring-brand-cyan/25", iconFg: "text-brand-cyan" },
    primary:   { bar: "bg-gradient-to-b from-primary to-primary-glow",        iconBg: "bg-primary/15 ring-1 ring-primary/25",       iconFg: "text-primary" },
    success:   { bar: "bg-gradient-to-b from-success/60 to-success",           iconBg: "bg-success/15 ring-1 ring-success/25", iconFg: "text-success" },
    secondary: { bar: "bg-gradient-to-b from-secondary to-secondary-glow",    iconBg: "bg-secondary/15 ring-1 ring-secondary/25",   iconFg: "text-secondary" },
  };
  const t = toneMap[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft ${highlight ? "border-secondary/40 ring-1 ring-secondary/20" : "border-border"}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg}`}>
          <Icon className={`h-4 w-4 ${t.iconFg}`} />
        </span>
      </div>
      <p className="font-display text-2xl md:text-[1.6rem] font-extrabold tabular-nums leading-tight mt-1.5 text-foreground">
        {value}
      </p>
      {hint && (
        <p className="text-2xs mt-1 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}