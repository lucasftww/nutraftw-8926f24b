import { formatBRL } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Tipos internos para os tooltips customizados
type TooltipPayloadItem = { dataKey?: string; value?: number; name?: string };
type CustomTooltipProps = { active?: boolean; payload?: TooltipPayloadItem[]; label?: string };

// Paleta vinda dos tokens HSL (index.css :root --chart-1..7).
const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
];

type DailyPoint = {
  date: string;
  label: string;
  weekday: string;
  revenue: number;
  orders: number;
};

type PiePoint = {
  name: string;
  value: number;
};

// Tooltip customizado com fundo sólido — o default do Recharts não herda
// a variável CSS de fundo, causando white-on-dark no tema admin.
function RevenueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const orders = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  return (
    <div className="min-w-[160px] rounded-xl border border-border bg-card shadow-pop px-3.5 py-2.5 text-sm">
      <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Receita
          </span>
          <span className="font-bold tabular-nums text-foreground">{formatBRL(Number(revenue))}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success inline-block" />
            Pedidos
          </span>
          <span className="font-semibold tabular-nums text-foreground">{orders}</span>
        </div>
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border bg-card shadow-pop px-3.5 py-2.5 text-sm max-w-[200px]">
      <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Receita: <span className="font-bold text-foreground tabular-nums">{formatBRL(Number(item.value))}</span>
      </p>
    </div>
  );
}

export default function WeeklyReportCharts({
  dailySeries,
  isHourly,
  pieData,
}: {
  dailySeries: DailyPoint[];
  isHourly: boolean;
  pieData: PiePoint[];
}) {
  const avgRevenue =
    dailySeries.length > 0
      ? dailySeries.reduce((s, d) => s + d.revenue, 0) / dailySeries.length
      : 0;
  const avgOrders =
    dailySeries.length > 0
      ? dailySeries.reduce((s, d) => s + d.orders, 0) / dailySeries.length
      : 0;

  return (
    <>
      {/* Gráfico combinado: barras de receita + linha de pedidos */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">{isHourly ? "Receita e pedidos por hora" : "Receita e pedidos por dia"}</h3>
          <span className="text-xs text-muted-foreground">
            {isHourly ? "24 horas" : `${dailySeries.length} dias`}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground mb-4">
          Barras = receita (eixo esquerdo) · Linha = pedidos (eixo direito)
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailySeries} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                width={56}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              {avgRevenue > 0 && (
                <ReferenceLine
                  yAxisId="revenue"
                  y={avgRevenue}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                  label={{ value: "Média", position: "insideTopLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
              )}
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4, radius: 6 }} />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="url(#revBarFill)"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              <Area
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="hsl(var(--success))"
                fillOpacity={0.08}
                dot={{ fill: "hsl(var(--success))", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda manual — a do Recharts não usa tokens CSS */}
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-5 rounded-sm bg-primary/80 inline-block" />
            Receita
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-px w-5 bg-success inline-block" />
            Pedidos
          </span>
          {avgRevenue > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-px w-5 border-t border-dashed border-primary/50 inline-block" />
              Média
            </span>
          )}
        </div>
      </div>

      {/* PieChart + estatísticas de período */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sumário rápido do período */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-bold mb-4">{isHourly ? "Resumo do dia" : "Resumo do período"}</h3>
          {dailySeries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="space-y-3">
              {/* Dia de maior receita */}
              {(() => {
                const best = [...dailySeries].sort((a, b) => b.revenue - a.revenue)[0];
                const worst = [...dailySeries].sort((a, b) => a.revenue - b.revenue)[0];
                const totalRev = dailySeries.reduce((s, d) => s + d.revenue, 0);
                const totalOrd = dailySeries.reduce((s, d) => s + d.orders, 0);
                return (
                  <div className="space-y-3">
                    <StatRow label="Receita total" value={formatBRL(totalRev)} tone="primary" />
                    <StatRow label="Total de pedidos" value={String(totalOrd)} tone="success" />
                    <StatRow label="Média por período" value={formatBRL(avgRevenue)} tone="neutral" />
                    <StatRow
                      label="Média de pedidos"
                      value={avgOrders >= 1 ? avgOrders.toFixed(1) : `< 1`}
                      tone="neutral"
                    />
                    {best && <StatRow label={isHourly ? "Hora de pico" : "Melhor dia"} value={`${best.label} · ${formatBRL(best.revenue)}`} tone="success" />}
                    {worst && worst.revenue < best?.revenue && (
                      <StatRow label={isHourly ? "Hora mais fraca" : "Dia mais fraco"} value={`${worst.label} · ${formatBRL(worst.revenue)}`} tone="neutral" />
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-bold mb-4">Receita por produto (top 5)</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem vendas no período.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value: string) =>
                      value.length > 22 ? `${value.slice(0, 20)}…` : value
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "neutral";
}) {
  const valueClass =
    tone === "primary"
      ? "text-primary font-bold"
      : tone === "success"
        ? "text-success font-bold"
        : "text-foreground font-semibold";
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
