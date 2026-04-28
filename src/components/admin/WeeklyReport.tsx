import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  startOfDay,
  endOfDay,
  subDays,
  eachDayOfInterval,
  format,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Package,
  Receipt,
  Calendar,
  Download,
} from "lucide-react";

type Range = "7d" | "14d" | "30d";

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type ItemRow = {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  quantity: number;
  subtotal: number;
  unit_price: number;
  order_id: string;
};

export function WeeklyReport() {
  const [range, setRange] = useState<Range>("7d");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderRow[]>([]);

  const days = range === "7d" ? 7 : range === "14d" ? 14 : 30;

  const { startDate, endDate, prevStart, prevEnd } = useMemo(() => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, days - 1));
    const pEnd = endOfDay(subDays(start, 1));
    const pStart = startOfDay(subDays(pEnd, days - 1));
    return { startDate: start, endDate: end, prevStart: pStart, prevEnd: pEnd };
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [curOrdersRes, prevOrdersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, status, created_at")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("orders")
          .select("id, total, status, created_at")
          .gte("created_at", prevStart.toISOString())
          .lte("created_at", prevEnd.toISOString()),
      ]);

      const curOrders = (curOrdersRes.data as OrderRow[]) || [];
      const paidIds = curOrders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.id);

      let curItems: ItemRow[] = [];
      if (paidIds.length > 0) {
        const { data: it } = await supabase
          .from("order_items")
          .select("product_id, product_name, product_image_url, quantity, subtotal, unit_price, order_id")
          .in("order_id", paidIds);
        curItems = (it as ItemRow[]) || [];
      }

      if (cancelled) return;
      setOrders(curOrders);
      setPrevOrders((prevOrdersRes.data as OrderRow[]) || []);
      setItems(curItems);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, prevStart, prevEnd]);

  const paid = useMemo(() => orders.filter((o) => PAID_STATUSES.includes(o.status)), [orders]);
  const prevPaid = useMemo(() => prevOrders.filter((o) => PAID_STATUSES.includes(o.status)), [prevOrders]);

  const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + Number(o.total || 0), 0);
  const ordersCount = paid.length;
  const prevOrdersCount = prevPaid.length;
  const aov = ordersCount > 0 ? revenue / ordersCount : 0;
  const prevAov = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
  const itemsSold = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  const dailySeries = useMemo(() => {
    const buckets = new Map<string, { revenue: number; orders: number }>();
    eachDayOfInterval({ start: startDate, end: endDate }).forEach((d) => {
      buckets.set(format(d, "yyyy-MM-dd"), { revenue: 0, orders: 0 });
    });
    for (const o of paid) {
      const k = format(new Date(o.created_at), "yyyy-MM-dd");
      const b = buckets.get(k);
      if (b) {
        b.revenue += Number(o.total || 0);
        b.orders += 1;
      }
    }
    return Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      label: format(new Date(date + "T12:00:00"), "dd/MM", { locale: ptBR }),
      weekday: format(new Date(date + "T12:00:00"), "EEE", { locale: ptBR }),
      revenue: Number(v.revenue.toFixed(2)),
      orders: v.orders,
    }));
  }, [paid, startDate, endDate]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; image: string | null; qty: number; revenue: number }>();
    for (const i of items) {
      const key = i.product_id || i.product_name;
      const cur = map.get(key) || { name: i.product_name, image: i.product_image_url, qty: 0, revenue: 0 };
      cur.qty += Number(i.quantity || 0);
      cur.revenue += Number(i.subtotal || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [items]);

  const top5 = topProducts.slice(0, 5);
  const pieData = top5.map((p) => ({ name: p.name, value: Number(p.revenue.toFixed(2)) }));

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) || 0) + 1);
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  function pctDelta(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  }

  function exportCSV() {
    const header = ["Data", "Pedidos pagos", "Receita (BRL)"];
    const rows = dailySeries.map((d) => [d.date, String(d.orders), d.revenue.toFixed(2)]);
    rows.push([]);
    rows.push(["Top produtos"]);
    rows.push(["Produto", "Qtd vendida", "Receita (BRL)"]);
    topProducts.forEach((p) => rows.push([p.name, String(p.qty), p.revenue.toFixed(2)]));
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(startDate, "yyyy-MM-dd")}_a_${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Receita", value: formatBRL(revenue), delta: pctDelta(revenue, prevRevenue), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Pedidos pagos", value: ordersCount, delta: pctDelta(ordersCount, prevOrdersCount), icon: ShoppingBag, color: "text-primary", bg: "bg-primary/10" },
    { label: "Ticket médio", value: formatBRL(aov), delta: pctDelta(aov, prevAov), icon: Receipt, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Itens vendidos", value: itemsSold, delta: null as number | null, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Relatório de vendas
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(startDate, "dd MMM", { locale: ptBR })} – {format(endDate, "dd MMM yyyy", { locale: ptBR })} · comparado ao período anterior
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-background p-1">
            {(["7d", "14d", "30d"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "7d" ? "7 dias" : r === "14d" ? "14 dias" : "30 dias"}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-background text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const positive = (c.delta ?? 0) >= 0;
          return (
            <div key={c.label} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div className={`inline-flex p-2 rounded-lg ${c.bg} ${c.color}`}>
                  <c.icon className="h-4 w-4" />
                </div>
                {c.delta !== null && !loading && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${positive ? "text-emerald-700 bg-emerald-50" : "text-destructive bg-destructive/10"}`}>
                    {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(c.delta).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">{c.label}</p>
              <p className="text-lg font-bold mt-0.5">{loading ? "…" : c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Daily revenue area chart */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Receita diária</h3>
          <span className="text-xs text-muted-foreground">{dailySeries.length} dias</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} width={60} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: number) => [formatBRL(v), "Receita"]}
                labelFormatter={(l) => `Dia ${l}`}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Orders per weekday */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-bold mb-4">Pedidos por dia</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [v, "Pedidos"]}
                />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue mix by product */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-bold mb-4">Receita por produto (top 5)</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem vendas no período.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top products table */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        <h3 className="font-bold mb-4">Produtos mais vendidos</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum produto vendido no período.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 px-4 md:px-2">#</th>
                  <th className="py-2 px-2">Produto</th>
                  <th className="py-2 px-2 text-right">Qtd</th>
                  <th className="py-2 px-4 md:px-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.slice(0, 10).map((p, i) => (
                  <tr key={p.name + i} className="border-b border-border/60 last:border-0">
                    <td className="py-3 px-4 md:px-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <img src={p.image || "/assets/no-image.svg"} alt="" className="h-9 w-9 rounded-lg object-cover bg-muted shrink-0" />
                        <span className="font-medium line-clamp-2">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums font-semibold">{p.qty}</td>
                    <td className="py-3 px-4 md:px-2 text-right tabular-nums font-bold text-primary">{formatBRL(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status breakdown */}
      {statusBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-bold mb-4">Pedidos por status</h3>
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map((s) => (
              <span key={s.status} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-semibold">
                <span className="capitalize">{s.status}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-primary">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}