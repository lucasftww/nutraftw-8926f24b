import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "./AdminErrorBanner";
import { toast } from "sonner";
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
  subtotal?: number;
  shipping?: number;
  insurance?: number;
  discount?: number;
  payment_method?: string | null;
  coupon_code?: string | null;
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
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
      setError(null);
      const [curOrdersRes, prevOrdersRes] = await Promise.all([
        (supabase as any)
          .from("orders")
          .select("id, total, status, created_at, subtotal, shipping, insurance, discount, payment_method, coupon_code")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("orders")
          .select("id, total, status, created_at")
          .gte("created_at", prevStart.toISOString())
          .lte("created_at", prevEnd.toISOString()),
      ]);

      if (curOrdersRes.error) {
        const info = logSupabaseError("Relatório · pedidos do período", curOrdersRes.error, {
          table: "orders",
          range,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
        if (cancelled) return;
        setError(info);
        toast.error(`Relatório: ${info.message}`);
        setLoading(false);
        return;
      }
      if (prevOrdersRes.error) {
        const info = logSupabaseError("Relatório · período anterior", prevOrdersRes.error, {
          table: "orders",
          range,
          prevStart: prevStart.toISOString(),
          prevEnd: prevEnd.toISOString(),
        });
        if (cancelled) return;
        setError(info);
        toast.error(`Relatório: ${info.message}`);
        setLoading(false);
        return;
      }

      const curOrders = ((curOrdersRes.data as unknown) as OrderRow[]) || [];
      const paidIds = curOrders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.id);

      let curItems: ItemRow[] = [];
      if (paidIds.length > 0) {
        const { data: it, error: itErr } = await supabase
          .from("order_items")
          .select("product_id, product_name, product_image_url, quantity, subtotal, unit_price, order_id")
          .in("order_id", paidIds);
        if (itErr) {
          const info = logSupabaseError("Relatório · itens dos pedidos", itErr, {
            table: "order_items",
            order_count: paidIds.length,
          });
          if (cancelled) return;
          setError(info);
          toast.error(`Relatório: ${info.message}`);
          setLoading(false);
          return;
        }
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
  }, [startDate, endDate, prevStart, prevEnd, reloadKey, range]);

  // IMPORTANTE: nenhum return condicional antes dos hooks abaixo — viola Rules of Hooks.
  const paid = useMemo(() => orders.filter((o) => PAID_STATUSES.includes(o.status)), [orders]);
  const prevPaid = useMemo(() => prevOrders.filter((o) => PAID_STATUSES.includes(o.status)), [prevOrders]);

  const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + Number(o.total || 0), 0);
  const ordersCount = paid.length;
  const prevOrdersCount = prevPaid.length;
  const aov = ordersCount > 0 ? revenue / ordersCount : 0;
  const prevAov = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
  const itemsSold = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  // ───────── Reconciliação financeira ─────────
  // Valida se o `total` gravado bate com: subtotal + shipping + insurance − discount − pix(5% se método=pix)
  // e se o `subtotal` da ordem bate com a soma dos `order_items.subtotal`.
  const reconciliation = useMemo(() => {
    const itemsByOrder = new Map<string, number>();
    for (const it of items) {
      itemsByOrder.set(it.order_id, (itemsByOrder.get(it.order_id) || 0) + Number(it.subtotal || 0));
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const TOL = 0.02; // 2 centavos de tolerância p/ arredondamento

    let sumSubtotal = 0;
    let sumShipping = 0;
    let sumInsurance = 0;
    let sumDiscount = 0;
    let sumPixDiscount = 0;
    let sumExpectedTotal = 0;
    let sumActualTotal = 0;
    let sumItemsSubtotal = 0;

    const totalMismatches: { id: string; expected: number; actual: number; diff: number }[] = [];
    const itemsMismatches: { id: string; orderSubtotal: number; itemsSubtotal: number; diff: number }[] = [];

    for (const o of paid) {
      const sub = Number(o.subtotal || 0);
      const ship = Number(o.shipping || 0);
      const ins = Number(o.insurance || 0);
      const disc = Number(o.discount || 0);
      const beforePix = round2(sub + ship + ins - disc);
      const pixDisc = o.payment_method === "pix" ? round2(beforePix * 0.05) : 0;
      const expected = round2(beforePix - pixDisc);
      const actual = Number(o.total || 0);

      sumSubtotal += sub;
      sumShipping += ship;
      sumInsurance += ins;
      sumDiscount += disc;
      sumPixDiscount += pixDisc;
      sumExpectedTotal += expected;
      sumActualTotal += actual;

      if (Math.abs(expected - actual) > TOL) {
        totalMismatches.push({ id: o.id, expected, actual, diff: round2(actual - expected) });
      }

      const itemsSub = round2(itemsByOrder.get(o.id) || 0);
      sumItemsSubtotal += itemsSub;
      // Só valida se há itens carregados para a ordem (evita falso-positivo p/ ordens sem itens cadastrados).
      if (itemsByOrder.has(o.id) && Math.abs(itemsSub - sub) > TOL) {
        itemsMismatches.push({ id: o.id, orderSubtotal: sub, itemsSubtotal: itemsSub, diff: round2(itemsSub - sub) });
      }
    }

    return {
      sumSubtotal: round2(sumSubtotal),
      sumShipping: round2(sumShipping),
      sumInsurance: round2(sumInsurance),
      sumDiscount: round2(sumDiscount),
      sumPixDiscount: round2(sumPixDiscount),
      sumExpectedTotal: round2(sumExpectedTotal),
      sumActualTotal: round2(sumActualTotal),
      totalDiff: round2(sumActualTotal - sumExpectedTotal),
      sumItemsSubtotal: round2(sumItemsSubtotal),
      itemsSubtotalDiff: round2(sumItemsSubtotal - sumSubtotal),
      totalMismatches,
      itemsMismatches,
      ordersChecked: paid.length,
    };
  }, [paid, items]);

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

  if (error) {
    return <AdminErrorBanner error={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

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

      {/* Validação financeira */}
      {!loading && reconciliation.ordersChecked > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-bold">Validação financeira</h3>
            {reconciliation.totalMismatches.length === 0 && reconciliation.itemsMismatches.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                ✓ Tudo bate ({reconciliation.ordersChecked} pedidos)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                ⚠ {reconciliation.totalMismatches.length + reconciliation.itemsMismatches.length} divergência(s)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Subtotal" value={formatBRL(reconciliation.sumSubtotal)} />
            <Stat label="Frete" value={formatBRL(reconciliation.sumShipping)} />
            <Stat label="Seguro" value={formatBRL(reconciliation.sumInsurance)} />
            <Stat label="Desconto cupom" value={`− ${formatBRL(reconciliation.sumDiscount)}`} />
            <Stat label="Desconto PIX (5%)" value={`− ${formatBRL(reconciliation.sumPixDiscount)}`} />
            <Stat label="Total esperado" value={formatBRL(reconciliation.sumExpectedTotal)} />
            <Stat label="Total real (DB)" value={formatBRL(reconciliation.sumActualTotal)} highlight />
            <Stat
              label="Diferença"
              value={formatBRL(Math.abs(reconciliation.totalDiff))}
              tone={Math.abs(reconciliation.totalDiff) > 0.02 ? "danger" : "ok"}
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Fórmula: <span className="font-mono">total = subtotal + frete + seguro − cupom − pix(5%)</span>.
            Reconciliação também valida que <span className="font-mono">subtotal</span> da ordem é igual à soma dos itens (
            {formatBRL(reconciliation.sumItemsSubtotal)} vs {formatBRL(reconciliation.sumSubtotal)} — diff{" "}
            {formatBRL(Math.abs(reconciliation.itemsSubtotalDiff))}).
          </p>

          {(reconciliation.totalMismatches.length > 0 || reconciliation.itemsMismatches.length > 0) && (
            <div className="mt-4 space-y-3">
              {reconciliation.totalMismatches.length > 0 && (
                <details className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" open>
                  <summary className="text-xs font-bold text-destructive cursor-pointer">
                    Pedidos com total divergente ({reconciliation.totalMismatches.length})
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs min-w-[420px]">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left py-1 pr-2">Pedido</th>
                          <th className="text-right py-1 px-2">Esperado</th>
                          <th className="text-right py-1 px-2">Real</th>
                          <th className="text-right py-1 pl-2">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliation.totalMismatches.slice(0, 20).map((m) => (
                          <tr key={m.id} className="border-t border-destructive/20">
                            <td className="py-1 pr-2 font-mono">#{m.id.slice(0, 8)}</td>
                            <td className="py-1 px-2 text-right tabular-nums">{formatBRL(m.expected)}</td>
                            <td className="py-1 px-2 text-right tabular-nums">{formatBRL(m.actual)}</td>
                            <td className="py-1 pl-2 text-right tabular-nums font-bold text-destructive">
                              {m.diff > 0 ? "+" : ""}
                              {formatBRL(m.diff)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              {reconciliation.itemsMismatches.length > 0 && (
                <details className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <summary className="text-xs font-bold text-amber-800 cursor-pointer">
                    Pedidos com subtotal ≠ soma dos itens ({reconciliation.itemsMismatches.length})
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs min-w-[420px]">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left py-1 pr-2">Pedido</th>
                          <th className="text-right py-1 px-2">Subtotal ordem</th>
                          <th className="text-right py-1 px-2">Soma itens</th>
                          <th className="text-right py-1 pl-2">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliation.itemsMismatches.slice(0, 20).map((m) => (
                          <tr key={m.id} className="border-t border-amber-200">
                            <td className="py-1 pr-2 font-mono">#{m.id.slice(0, 8)}</td>
                            <td className="py-1 px-2 text-right tabular-nums">{formatBRL(m.orderSubtotal)}</td>
                            <td className="py-1 px-2 text-right tabular-nums">{formatBRL(m.itemsSubtotal)}</td>
                            <td className="py-1 pl-2 text-right tabular-nums font-bold text-amber-800">
                              {m.diff > 0 ? "+" : ""}
                              {formatBRL(m.diff)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "ok" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "ok"
        ? "text-emerald-700"
        : highlight
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums mt-0.5 ${toneClass}`}>{value}</p>
    </div>
  );
}