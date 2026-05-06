import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, ShoppingCart, CreditCard, CheckCircle2, TrendingDown, Loader2, Calendar, ArrowRight, Users, ShoppingBag, DollarSign, Sparkles, AlertTriangle } from "lucide-react";
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
  const [periodId, setPeriodId] = useState<PeriodId>("30d");
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
    // Paleta degradê: ciano (topo de funil, descoberta) → primary → secondary
    // (intenção) → success (conversão). Cada etapa tem cor própria pra
    // facilitar leitura visual rápida.
    return [
      { key: "views",    label: "Visualizações",       value: s.views,            icon: Eye,          gradient: "from-sky-400 to-cyan-500",        accent: "text-sky-600" },
      { key: "wishlist", label: "Favoritos",           value: s.wishlist_adds,    icon: Heart,        gradient: "from-cyan-500 to-primary",         accent: "text-cyan-700" },
      { key: "cart",     label: "Adições ao carrinho", value: s.cart_adds,        icon: ShoppingCart, gradient: "from-primary to-primary-glow",     accent: "text-primary" },
      { key: "checkout", label: "Checkout iniciado",   value: s.checkout_started, icon: CreditCard,   gradient: "from-secondary to-amber-500",      accent: "text-secondary" },
      { key: "paid",     label: "Pedidos pagos",       value: s.orders_paid,      icon: CheckCircle2, gradient: "from-emerald-500 to-success",      accent: "text-success" },
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

          {/* Funil visual: SVG real (trapezoides empilhados) + detalhes ao lado */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-5 md:p-7 shadow-card">
            <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-base md:text-lg">Etapas do funil</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cada faixa representa o volume real da etapa.
                </p>
              </div>
              <span className="badge-pill bg-gradient-to-r from-primary to-brand-cyan text-primary-foreground border-0 shadow-sm">
                {pct(overallConversion)} ponta-a-ponta
              </span>
            </header>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_1.1fr] gap-6 lg:gap-8 lg:items-center">
              {/* SVG do funil */}
              <FunnelSVG stages={stages} />

              {/* Lista de etapas com métricas */}
              <ol className="space-y-2">
                {stages.map((s, i) => {
                  const prev = i > 0 ? stages[i - 1] : null;
                  const stepConv = prev ? ratio(s.value, prev.value) : 1;
                  const dropPct = prev ? Math.max(0, 1 - stepConv) : 0;
                  const showDrop = !!prev && dropPct > 0.3 && (prev.value - s.value) >= 5;
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.key}
                      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors px-3 py-2.5"
                    >
                      <span
                        aria-hidden
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient} text-white shadow-sm shrink-0`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground leading-none">
                          {i + 1}. {s.label}
                        </p>
                        <p className="font-display text-lg font-extrabold tabular-nums leading-tight mt-0.5 text-foreground">
                          {s.value.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      {prev ? (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                            Conversão
                          </p>
                          <p className={`font-bold text-sm tabular-nums leading-tight mt-0.5 ${showDrop ? "text-amber-600" : "text-foreground"}`}>
                            {pct(stepConv)}
                          </p>
                        </div>
                      ) : (
                        <span className="badge-pill bg-muted text-muted-foreground shrink-0">Topo</span>
                      )}
                      {showDrop && (
                        <span
                          aria-hidden
                          title={`${pct(dropPct)} abandona aqui`}
                          className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-background"
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <p className="mt-5 pt-4 border-t border-border/60 text-[11px] text-muted-foreground/80 leading-relaxed">
              Etapas de origens diferentes (analytics × pedidos) podem variar. Foque na tendência relativa, não no número absoluto.
            </p>
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
              <div className="overflow-x-auto -mx-5 md:mx-0">
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
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowVtc ? "text-amber-500" : ""}`}>
                            {pct(r.view_to_cart)}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums font-semibold ${lowCtp ? "text-amber-500" : ""}`}>
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
              Em <span className="text-amber-500 font-medium">âmbar</span>: pontos com baixa conversão (View→Cart &lt; 5% com 10+ views, ou Cart→Paid &lt; 20% com 5+ carrinhos).
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
 * Funil em SVG: trapezoides empilhados, largura proporcional ao valor da etapa.
 * Cada faixa tem gradiente próprio. Renderiza valor + label dentro da faixa.
 */
function FunnelSVG({ stages }: { stages: Array<{ key: string; label: string; value: number; gradient: string }> }) {
  const W = 520;
  const H = 360;
  const top = stages[0]?.value || 1;
  const minWidthRatio = 0.18; // garante que a última faixa nunca fique invisível
  const widths = stages.map((s) => {
    const r = top > 0 ? s.value / top : 0;
    return Math.max(minWidthRatio, r);
  });
  const bandH = H / stages.length;
  // Mapeia o gradient tailwind do stage para stops HSL. Mantemos pares fixos
  // pra garantir consistência sem depender do compilador Tailwind no SVG.
  const palette: Record<string, [string, string]> = {
    views: ["#7DD3FC", "#06B6D4"],
    wishlist: ["#22D3EE", "#0B1F6B"],
    cart: ["#0B1F6B", "#1E63C8"],
    checkout: ["#F97316", "#F59E0B"],
    paid: ["#10B981", "#16A34A"],
  };
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Funil de conversão">
        <defs>
          {stages.map((s) => {
            const [c1, c2] = palette[s.key] || ["#0B1F6B", "#3FC1E5"];
            return (
              <linearGradient key={s.key} id={`fnl-${s.key}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={c1} />
                <stop offset="1" stopColor={c2} />
              </linearGradient>
            );
          })}
          <filter id="fnl-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0B1F6B" floodOpacity="0.18" />
          </filter>
        </defs>
        {stages.map((s, i) => {
          const wTop = widths[i] * W;
          const wBot = (widths[i + 1] ?? widths[i] * 0.85) * W;
          const y0 = i * bandH;
          const y1 = y0 + bandH - 6; // gap entre faixas
          const xTopL = (W - wTop) / 2;
          const xTopR = xTopL + wTop;
          const xBotL = (W - wBot) / 2;
          const xBotR = xBotL + wBot;
          const d = `M${xTopL},${y0} L${xTopR},${y0} L${xBotR},${y1} L${xBotL},${y1} Z`;
          const cx = W / 2;
          const cy = y0 + bandH / 2 - 3;
          return (
            <g key={s.key} filter="url(#fnl-shadow)">
              <path d={d} fill={`url(#fnl-${s.key})`} />
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#FFFFFF"
                opacity="0.92"
                style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                {s.label}
              </text>
              <text
                x={cx}
                y={cy + 16}
                textAnchor="middle"
                fontSize="20"
                fontWeight="800"
                fill="#FFFFFF"
              >
                {s.value.toLocaleString("pt-BR")}
              </text>
            </g>
          );
        })}
      </svg>
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
  const toneMap: Record<KpiTone, { bar: string; iconBg: string; iconFg: string; chipBg: string }> = {
    cyan:      { bar: "bg-gradient-to-b from-sky-400 to-cyan-500", iconBg: "bg-sky-100",       iconFg: "text-sky-600",       chipBg: "bg-sky-50" },
    primary:   { bar: "bg-gradient-to-b from-primary to-primary-glow", iconBg: "bg-primary/10", iconFg: "text-primary",     chipBg: "bg-primary/5" },
    success:   { bar: "bg-gradient-to-b from-emerald-500 to-success", iconBg: "bg-emerald-100", iconFg: "text-emerald-700", chipBg: "bg-emerald-50" },
    secondary: { bar: "bg-gradient-to-b from-secondary to-amber-500", iconBg: "bg-secondary/10", iconFg: "text-secondary",  chipBg: "bg-secondary/5" },
  };
  const t = toneMap[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft ${highlight ? "border-secondary/40 ring-1 ring-secondary/20" : "border-border"}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        <p className="text-[11px] mt-1 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}