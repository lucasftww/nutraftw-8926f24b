import { useCallback, useEffect, useMemo, useState } from "react";
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
      const [ordersRes, productsRes, customersRes] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at, shipping_full_name").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, stock, price, image_url"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      if (ordersRes.error) {
        const info = logSupabaseError("Carregar pedidos", ordersRes.error, { table: "orders" });
        setError(info);
        toast.error(`Pedidos: ${info.message}`);
        setLoading(false);
        return;
      }
      if (productsRes.error) {
        const info = logSupabaseError("Carregar produtos", productsRes.error, { table: "products" });
        setError(info);
        toast.error(`Produtos: ${info.message}`);
        setLoading(false);
        return;
      }
      if (customersRes.error) {
        const info = logSupabaseError("Contar clientes", customersRes.error, { table: "profiles" });
        setError(info);
        toast.error(`Clientes: ${info.message}`);
        setLoading(false);
        return;
      }

      const orders = ordersRes.data;
      const products = productsRes.data;
      const customersCount = customersRes.count;

      const paidOrders = (orders || []).filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status));
      // Receita = soma do `total` das ordens pagas. `total` já é líquido (após cupom + PIX).
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const pendingOrders = (orders || []).filter((o) => o.status === "pending").length;
      const lowStock = (products || []).filter((p) => (p.stock || 0) < 5).length;
      const paidOrdersCount = paidOrders.length;
      const aov = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0;

      // Top produtos REAIS, derivados de order_items das ordens pagas.
      let itemsSold = 0;
      let topProducts: any[] = [];
      if (paidOrders.length > 0) {
        const paidIds = paidOrders.map((o) => o.id);
        const { data: oi, error: oiErr } = await supabase
          .from("order_items")
          .select("product_id, product_name, product_image_url, quantity, subtotal")
          .in("order_id", paidIds);
        if (oiErr) {
          const info = logSupabaseError("Carregar itens dos pedidos", oiErr, {
            table: "order_items",
            order_count: paidIds.length,
          });
          setError(info);
          toast.error(`Itens: ${info.message}`);
          setLoading(false);
          return;
        }
        const agg = new Map<string, { id: string | null; name: string; image: string | null; qty: number; revenue: number }>();
        for (const it of (oi as any[]) || []) {
          const key = it.product_id || it.product_name;
          const cur = agg.get(key) || { id: it.product_id, name: it.product_name, image: it.product_image_url, qty: 0, revenue: 0 };
          cur.qty += Number(it.quantity || 0);
          cur.revenue += Number(it.subtotal || 0);
          itemsSold += Number(it.quantity || 0);
          agg.set(key, cur);
        }
        topProducts = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      }

      setStats({
        totalRevenue,
        totalOrders: (orders || []).length,
        paidOrdersCount,
        aov,
        itemsSold,
        pendingOrders,
        totalProducts: (products || []).length,
        lowStock,
        totalCustomers: customersCount || 0,
        recentOrders: (orders || []).slice(0, 5),
        topProducts,
      });

      // ===== Últimas 24h: vendas + mini funil =====
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const last24Orders = (orders || []).filter((o) => o.created_at >= since);
      const last24Paid = last24Orders.filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status));
      const recentSales = last24Orders
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 6);

      const [ev24, wl24, ci24] = await Promise.all([
        supabase.from("product_events").select("event_type", { head: false, count: "exact" }).gte("created_at", since),
        supabase.from("wishlists").select("id", { head: true, count: "exact" }).gte("created_at", since),
        supabase.from("cart_items").select("id", { head: true, count: "exact" }).gte("created_at", since),
      ]);
      const events = (ev24.data as Array<{ event_type: string }> | null) || [];
      const views = events.filter((e) => e.event_type === "view").length;
      const checkoutStarted = events.filter((e) => e.event_type === "checkout_started").length;

      setLast24h({
        ordersCount: last24Orders.length,
        paidCount: last24Paid.length,
        revenue: last24Paid.reduce((s, o) => s + Number(o.total || 0), 0),
        views,
        wishlist: wl24.count || 0,
        cartAdds: ci24.count || 0,
        checkoutStarted,
        recentSales,
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
    return <div className="text-center py-12 text-muted-foreground">Carregando métricas…</div>;
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
    success:     "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20",
    amber:       "text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20",
    destructive: "text-destructive bg-destructive/10 ring-1 ring-destructive/25",
    neutral:     "text-muted-foreground bg-muted/50 ring-1 ring-border",
  };

  // Quando ainda não há nenhuma venda, mostra um banner informativo no topo
  // em vez de só números zerados — ajuda o admin novo a entender a tela.
  const hasNoSales = stats.totalOrders === 0;

  return (
    <div className="space-y-6">
      {/* Banner de boas-vindas com saudação por horário */}
      <WelcomeBanner
        revenue={stats.totalRevenue}
        ordersToday={stats.recentOrders.filter((o) => isToday(o.created_at)).length}
      />

      {last24h && <Last24hPanel data={last24h} />}

      {hasNoSales && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Tudo pronto para o primeiro pedido</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              As métricas começam a popular assim que houver vendas. Verifique o catálogo e configure cupons em <strong>Vendas → Cupons</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-4 hover:border-border/80 transition-colors">
            <div className={`inline-flex p-2 rounded-lg ${TONE[c.tone]} mb-3`}>
              <c.icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">{c.label}</p>
            <p className="text-xl font-semibold mt-1 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border p-5">
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{o.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
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
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary-glow to-brand-cyan p-5 md:p-6 text-primary-foreground shadow-elegant">
      <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute -right-4 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">Painel Royal Vita</p>
          <h2 className="font-brand text-2xl md:text-3xl font-bold mt-1 tracking-tight uppercase">
            {greeting}, admin
          </h2>
          <p className="text-sm opacity-85 mt-1.5 max-w-md">
            {ordersToday > 0
              ? `${ordersToday} ${ordersToday === 1 ? "pedido novo" : "pedidos novos"} hoje. Continue assim.`
              : "Sem pedidos novos ainda hoje. Hora de revisar promoções?"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Receita acumulada</p>
          <p className="font-display text-2xl md:text-3xl font-extrabold tabular-nums mt-1">
            {revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>
    </div>
  );
}
