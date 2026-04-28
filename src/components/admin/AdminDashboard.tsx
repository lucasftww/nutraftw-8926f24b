import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Package, ShoppingBag, DollarSign, Users, TrendingUp, Clock, Receipt, Boxes } from "lucide-react";

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

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: orders },
        { data: products },
        { count: customersCount },
      ] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at, shipping_full_name").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, stock, price, image_url"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

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
        const { data: oi } = await supabase
          .from("order_items")
          .select("product_id, product_name, product_image_url, quantity, subtotal")
          .in("order_id", paidIds);
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
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return <div className="text-center py-12 text-muted-foreground">Carregando métricas…</div>;
  }

  const cards = [
    { label: "Receita líquida", value: formatBRL(stats.totalRevenue), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Pedidos pagos", value: stats.paidOrdersCount, icon: ShoppingBag, color: "text-primary", bg: "bg-primary/10" },
    { label: "Ticket médio", value: formatBRL(stats.aov), icon: Receipt, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Itens vendidos", value: stats.itemsSold, icon: Boxes, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Pendentes", value: stats.pendingOrders, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Produtos", value: stats.totalProducts, icon: Package, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Stock baixo", value: stats.lowStock, icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Clientes", value: stats.totalCustomers, icon: Users, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-4">
            <div className={`inline-flex p-2 rounded-lg ${c.bg} ${c.color} mb-3`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-lg font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-4">Pedidos recentes</h3>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
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

        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-4">Produtos mais vendidos</h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.topProducts.map((p, i) => (
                <li key={(p.id || p.name) + i} className="py-3 flex items-center gap-3 text-sm">
                  <img src={p.image || "/assets/no-image.svg"} alt={p.name} className="w-10 h-10 rounded object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
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
