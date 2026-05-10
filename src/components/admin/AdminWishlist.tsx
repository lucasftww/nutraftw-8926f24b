import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import { Heart, Search, AlertTriangle, Package, Users as UsersIcon, ShoppingCart, TrendingDown } from "lucide-react";
import { ProductThumb } from "@/components/admin/ProductThumb";
import { EmptyState } from "@/components/admin/EmptyState";
import { toast } from "sonner";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { friendlyErrorMessage } from "@/lib/friendlyError";

type Row = {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  is_active: boolean;
  is_on_offer: boolean;
  wishlist_count: number;
  unique_users: number;
  cart_count: number;
  units_paid: number;
  last_added_at: string | null;
};

const PERIODS = [
  { id: 1,   label: "24h" },
  { id: 7,   label: "7 dias" },
  { id: 30,  label: "30 dias" },
  { id: 90,  label: "90 dias" },
  { id: 365, label: "1 ano" },
] as const;

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function AdminWishlist() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(1);
  const [q, setQ] = useState("");
  const [error, setError] = useState<AdminErrorInfo | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase.rpc("admin_top_wishlist", {
        p_days: days,
        p_limit: 100,
      });
      if (!alive) return;
      if (error) {
        // Antes a falha era silenciada com `console.error` + `setRows([])`,
        // dando ao admin a impressão de "sem favoritos no período" quando
        // na verdade o RPC quebrou (ex.: schema drift, RLS, timeout).
        const info = logSupabaseError("Carregar wishlist", error, { rpc: "admin_top_wishlist", days });
        setError(info);
        toast.error(`Wishlist: ${friendlyErrorMessage(error)}`);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [days]);

  if (error) return <AdminErrorBanner error={error} onRetry={() => setDays((d) => d)} />;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => r.product_name.toLowerCase().includes(term));
  }, [rows, q]);

  const totals = useMemo(() => ({
    products: rows.length,
    favorites: rows.reduce((a, r) => a + Number(r.wishlist_count || 0), 0),
    users: rows.reduce((a, r) => a + Number(r.unique_users || 0), 0),
    lowStock: rows.filter(r => (r.stock ?? 0) <= 5 && Number(r.wishlist_count || 0) > 0).length,
  }), [rows]);

  const maxFav = Math.max(1, ...rows.map(r => Number(r.wishlist_count || 0)));

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Heart} label="Produtos favoritados" value={totals.products} tone="rose" />
        <StatCard icon={Heart} label="Favoritos no período" value={totals.favorites} tone="rose" />
        <StatCard icon={UsersIcon} label="Clientes interessados" value={totals.users} tone="cyan" />
        <StatCard icon={AlertTriangle} label="Favoritos sem estoque" value={totals.lowStock} tone="amber" hint="Favoritado e com ≤ 5 em estoque" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <Button
              key={p.id}
              size="sm"
              variant={days === p.id ? "default" : "outline"}
              onClick={() => setDays(p.id)}
              className="h-8 px-3 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto…" className="pl-9 h-9" />
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Sem favoritos no período"
            description="Quando os clientes favoritarem produtos, eles aparecem aqui — ordenados pelos mais desejados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Produto</th>
                  <th className="text-left font-medium px-3 py-3 w-[28%]">Demanda</th>
                  <th className="text-right font-medium px-3 py-3">Carrinho</th>
                  <th className="text-right font-medium px-3 py-3">Vendidos</th>
                  <th className="text-right font-medium px-3 py-3">Estoque</th>
                  <th className="text-right font-medium px-4 py-3">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((r) => {
                  const fav = Number(r.wishlist_count || 0);
                  const widthPct = Math.max(6, (fav / maxFav) * 100);
                  const stock = r.stock ?? 0;
                  const isLow = stock <= 5;
                  const isOut = stock === 0;
                  const finalPrice = r.sale_price && r.sale_price > 0 && r.sale_price < r.price ? r.sale_price : r.price;
                  return (
                    <tr key={r.product_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <ProductThumb src={r.product_image_url ?? undefined} alt={r.product_name} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate max-w-[280px]">{r.product_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{formatBRL(finalPrice)}</span>
                              {!r.is_active && <span className="text-amber-500">• inativo</span>}
                              {r.is_on_offer && <span className="text-emerald-500">• promo</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <div className="text-xs font-medium text-foreground tabular-nums w-16 text-right">
                            <Heart className="inline h-3 w-3 mr-1 text-rose-500 fill-rose-500" />
                            {fav}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" /> {r.unique_users} {r.unique_users === 1 ? "cliente" : "clientes"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <ShoppingCart className="h-3.5 w-3.5" />{r.cart_count}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.units_paid}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500 text-xs font-medium">
                            <TrendingDown className="h-3 w-3" /> Esgotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 text-xs font-medium">
                            <AlertTriangle className="h-3 w-3" /> {stock}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-xs font-medium">
                            <Package className="h-3 w-3" /> {stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(r.last_added_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ordenado pelos produtos mais favoritados {days === 1 ? "nas últimas 24 horas" : `nos últimos ${days} dias`}. Use isso para priorizar reposição de estoque.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, hint }: { icon: any; label: string; value: number; tone: "rose" | "cyan" | "amber"; hint?: string }) {
  const toneMap = {
    rose:  "from-rose-500/15 to-rose-500/5 text-rose-500",
    cyan:  "from-cyan-500/15 to-cyan-500/5 text-cyan-500",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-500",
  } as const;
  return (
    <div className={`rounded-xl border border-border/60 bg-gradient-to-br ${toneMap[tone]} p-4`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <Icon className="h-4 w-4" /> <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}