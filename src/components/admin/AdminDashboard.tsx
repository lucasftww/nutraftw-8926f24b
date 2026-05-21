import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_STATUS_COLORS as STATUS_COLORS, STATUS_PT } from "@/lib/orderStatus";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Package, ShoppingBag, DollarSign, Users, TrendingUp, Clock, Receipt, Boxes, Sparkles, Eye, Heart, ShoppingCart, CreditCard, CheckCircle2, Zap } from "lucide-react";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";
import { ProductThumb } from "./ProductThumb";
import { EmptyState } from "./EmptyState";
import { toast } from "sonner";

type Stats = {
  totalRevenue: number;
  totalOrders: number;
  paidOrdersCount: number;
  aov: number;
  itemsSold: number;
  pendingOrders: number;
  totalProducts: number;
  lowStock: number;
  totalCustomers: number;
  recentOrders: any[];
  topProducts: any[];
};

type Last24h = {
  ordersCount: number;
  paidCount: number;
  revenue: number;
  views: number;
  wishlist: number;
  cartAdds: number;
  checkoutStarted: number;
  recentSales: Array<{ id: string; total: number; status: string; created_at: string; shipping_full_name: string | null }>;
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [last24h, setLast24h] = useState<Last24h | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // RPC agregada server-side (escala para milhões de pedidos).
      // Antes baixávamos TODOS os pedidos para somar no client — quebrava
      // ao passar de 1000 (limite default do Supabase) e gerava payload
      // inviável em produção.
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_dashboard_stats");
      if (rpcErr) {
        const info = logSupabaseError("Dashboard", rpcErr, { rpc: "admin_dashboard_stats" });
        setError(info);
        toast.error(`Dashboard: ${info.message}`);
        setLoading(false);
        return;
      }
      const d: any = data || {};
      setStats({
        totalRevenue: Number(d.total_revenue || 0),
        totalOrders: Number(d.total_orders || 0),
        paidOrdersCount: Number(d.paid_orders_count || 0),
        aov: Number(d.aov || 0),
        itemsSold: Number(d.items_sold || 0),
        pendingOrders: Number(d.pending_orders || 0),
        totalProducts: Number(d.total_products || 0),
        lowStock: Number(d.low_stock || 0),
        totalCustomers: Number(d.total_customers || 0),
        recentOrders: Array.isArray(d.recent_orders) ? d.recent_orders : [],
        topProducts: Array.isArray(d.top_products) ? d.top_products : [],
      });
      const l24 = d.last24h || {};
      setLast24h({
        ordersCount: Number(l24.orders_count || 0),
        paidCount: Number(l24.paid_count || 0),
        revenue: Number(l24.revenue || 0),
        views: Number(l24.views || 0),
        wishlist: Number(l24.wishlist || 0),
        cartAdds: Number(l24.cart_adds || 0),
        checkoutStarted: Number(l24.checkout_started || 0),
        recentSales: Array.isArray(l24.recent_sales) ? l24.recent_sales : [],
      });
      setLoading(false);
    } catch (e: any) {
      const info = logSupabaseError("Dashboard", e);
      setError(info);
      toast.error(`Dashboard: ${info.message}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <AdminErrorBanner error={error} onRetry={load} />;
  }

  if (loading || !stats) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="h-28 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
        </div>
      </div>
    );
  }

  // Paleta consistente (admin dark): primary cyan, success green, amber para atenção,
  // destructive só para crítico (estoque baixo). Sem cores aleatórias.
  const cards = [
    { label: "Receita líquida", value: formatBRL(stats.totalRevenue), icon: DollarSign, tone: "success" as const, hint: "soma do total de pedidos pagos" },
    { label: "Pedidos pagos",   value: stats.paidOrdersCount,         icon: ShoppingBag, tone: "primary" as const },
    { label: "Ticket médio",    value: formatBRL(stats.aov),          icon: Receipt,     tone: "primary" as const },
    { label: "Itens vendidos",  value: stats.itemsSold,               icon: Boxes,       tone: "neutral" as const },
    { label: "Pendentes",       value: stats.pendingOrders,           icon: Clock,       tone: "amber" as const },
    { label: "Produtos",        value: stats.totalProducts,           icon: Package,     tone: "neutral" as const },
    { label: "Estoque baixo",   value: stats.lowStock,                icon: TrendingUp,  tone: "destructive" as const },
    { label: "Clientes",        value: stats.totalCustomers,          icon: Users,       tone: "primary" as const },
  ];
  const TONE: Record<string, string> = {
    primary:     "text-primary bg-primary/10 ring-1 ring-primary/15",
    success:     "text-success bg-success/10 ring-1 ring-success/20",
    amber:       "text-warning bg-warning/10 ring-1 ring-warning/20",
    destructive: "text-destructive bg-destructive/10 ring-1 ring-destructive/25",
    neutral:     "text-muted-foreground bg-muted/50 ring-1 ring-border",
  };

  // Quando ainda não há nenhuma venda, mostra um banner informativo no topo
  // em vez de só números zerados — ajuda o admin novo a entender a tela.
  const hasNoSales = stats.totalOrders === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Banner de boas-vindas com saudação por horário */}
      <WelcomeBanner
        revenue={stats.totalRevenue}
        ordersToday={stats.recentOrders.filter((o) => isToday(o.created_at)).length}
      />

      {last24h && <Last24hPanel data={last24h} />}

      {hasNoSales && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Tudo pronto para o primeiro pedido</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              As métricas começam a popular assim que houver vendas. Verifique o catálogo e configure cupons em <strong>Vendas → Cupons</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            // Redesign: gradient sutil do canto, hover lift suave, ring colorida
            // do tom. Mais "vivo" que o card chapado anterior.
            className="group relative bg-card rounded-2xl border border-border/70 p-3.5 md:p-4 hover:border-primary/30 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.25)] transition-all flex flex-col min-h-[104px] overflow-hidden"
          >
            {/* Glow sutil no canto que casa com o tone do card */}
            <span
              aria-hidden
              className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity ${
                c.tone === "success"     ? "bg-success/20"
                : c.tone === "amber"     ? "bg-warning/20"
                : c.tone === "destructive" ? "bg-destructive/20"
                : "bg-primary/20"
              }`}
            />
            <div className="relative flex items-center justify-between mb-2.5">
              <span className={`inline-flex p-1.5 rounded-lg ${TONE[c.tone]}`}>
                <c.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
            </div>
            <p className="relative text-2xs uppercase tracking-[0.14em] text-muted-foreground/80 font-medium leading-tight">{c.label}</p>
            <p className="relative text-lg md:text-xl font-bold mt-1 tabular-nums truncate text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-card rounded-2xl border border-border p-4 md:p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" /> Pedidos recentes
          </h3>
          {stats.recentOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum pedido encontrado"
              description="Quando uma compra for feita, ela aparecerá aqui."
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentOrders.map((o) => (
                <li key={o.id} className="py-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">{o.shipping_full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{o.id.slice(0, 8)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatBRL(o.total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status as keyof typeof STATUS_COLORS] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_PT[o.status] ?? o.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 md:p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" /> Produtos mais vendidos
          </h3>
          {stats.topProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Sem vendas no período"
              description="Os produtos mais vendidos aparecerão aqui após o primeiro pagamento."
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {stats.topProducts.map((p, i) => (
                <li key={(p.id || p.name) + i} className="py-3 flex items-center gap-3 text-sm">
                  <ProductThumb src={p.image} size="sm" alt={p.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.qty} unid. vendidas</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatBRL(p.revenue)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function WelcomeBanner({ revenue, ordersToday }: { revenue: number; ordersToday: number }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);
  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/15 p-4 md:p-7 text-foreground shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]">
      {/* Glow effects mais intensos para dar profundidade premium */}
      <div aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/25 to-brand-cyan/15 blur-3xl" />
      <div aria-hidden className="absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-brand-cyan/15 blur-3xl" />
      {/* Border decorativo no canto */}
      <div aria-hidden className="absolute top-0 right-0 h-px w-1/2 bg-gradient-to-l from-primary/40 to-transparent" />
      <div aria-hidden className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-brand-cyan/30 to-transparent" />

      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-1 w-6 rounded-full bg-gradient-to-r from-primary to-brand-cyan" aria-hidden />
            <p className="text-2xs font-bold uppercase tracking-[0.22em] text-primary/90">
              Painel Administrativo
            </p>
          </div>
          <h2 className="font-brand text-2xl md:text-4xl font-bold tracking-tight uppercase text-foreground leading-tight">
            {greeting}, admin
          </h2>
          <p className="text-sm-plus md:text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            {ordersToday > 0
              ? <>
                  <span className="font-bold text-foreground tabular-nums">{ordersToday}</span>{" "}
                  {ordersToday === 1 ? "pedido novo" : "pedidos novos"} hoje. Continue assim.
                </>
              : "Sem pedidos novos ainda hoje. Hora de revisar promoções?"}
          </p>
        </div>
        <div className="md:text-right shrink-0">
          <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
            Receita acumulada
          </p>
          <p className="font-display text-2xl md:text-4xl font-extrabold tabular-nums mt-1.5 bg-gradient-to-r from-primary via-primary-glow to-brand-cyan bg-clip-text text-transparent leading-none">
            {revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  return `${d} d atrás`;
}

function Last24hPanel({ data }: { data: Last24h }) {
  // Mini funil das últimas 24h usando os dados do RPC
  const funnelSteps = [
    { icon: Eye,          label: "Views",     value: data.views,            color: "text-brand-cyan" },
    { icon: Heart,        label: "Favoritos", value: data.wishlist,          color: "text-primary" },
    { icon: ShoppingCart, label: "Carrinho",  value: data.cartAdds,         color: "text-primary" },
    { icon: CreditCard,   label: "Checkout",  value: data.checkoutStarted,  color: "text-secondary" },
    { icon: CheckCircle2, label: "Pagos",     value: data.paidCount,        color: "text-success" },
  ];

  return (
    <div className="space-y-4">
      {/* Mini funil rápido */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">
        <header className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-success/70 to-success text-success-foreground shadow-sm">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm">Últimas 24h</h3>
            <p className="text-2xs text-muted-foreground">
              {data.ordersCount} {data.ordersCount === 1 ? "pedido" : "pedidos"} · {data.paidCount} pagos · {formatBRL(data.revenue)}
            </p>
          </div>
        </header>

        {/* Linha de funil */}
        <div className="grid grid-cols-5 gap-1 md:gap-2">
          {funnelSteps.map((step, i) => {
            const Icon = step.icon;
            const prev = i > 0 ? funnelSteps[i - 1].value : 0;
            const conv = prev > 0 ? Math.round((step.value / prev) * 100) : null;
            return (
              <div key={step.label} className="flex flex-col items-center text-center gap-1">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 ${step.color} relative z-10`}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <p className="font-bold text-base md:text-lg tabular-nums leading-none">{step.value.toLocaleString("pt-BR")}</p>
                <p className="text-2xs text-muted-foreground leading-tight">{step.label}</p>
                {conv !== null && (
                  <span className={`text-2xs font-semibold tabular-nums ${conv < 20 ? "text-warning" : "text-muted-foreground"}`}>
                    {conv}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">
        <h3 className="font-bold text-sm mb-3">Vendas recentes</h3>
        {data.recentSales.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma venda nas últimas 24 horas.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentSales.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{o.shipping_full_name || "Cliente"}</p>
                  <p className="text-2xs text-muted-foreground font-mono">
                    #{o.id.slice(0, 8)} · {timeAgo(o.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums">{formatBRL(o.total)}</p>
                  <span className={`inline-block text-2xs px-2 py-0.5 rounded-full mt-0.5 font-semibold ${STATUS_COLORS[o.status as keyof typeof STATUS_COLORS] ?? "bg-muted text-muted-foreground ring-1 ring-border"}`}>
                    {STATUS_PT[o.status as keyof typeof STATUS_PT] ?? o.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
