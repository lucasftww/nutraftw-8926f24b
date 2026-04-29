import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { formatBRL } from "@/lib/utils";
import { imageUrl } from "@/lib/image";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  stock: number;
  category_id: string | null;
  is_featured: boolean;
}

/**
 * "Frequentemente comprado junto" no CartDrawer.
 * Heurística: pega 4 produtos da MESMA categoria do primeiro item do carrinho,
 * excluindo itens já no carrinho. Se faltar, completa com `is_featured`.
 * O objetivo é aumentar AOV antes do checkout sem distrair de finalizar.
 */
export function CrossSell() {
  const { lines, add } = useCart();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const inCart = new Set(lines.map((l) => l.product_id));
  // Reagir só ao conjunto de produtos no carrinho (não às quantidades).
  const cartKey = lines.map((l) => l.product_id).sort().join(",");

  useEffect(() => {
    if (lines.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    (async () => {
      // 1) Buscar a categoria do primeiro item para basear a sugestão.
      const firstId = lines[0]?.product_id;
      const { data: base } = await supabase
        .from("products")
        .select("category_id")
        .eq("id", firstId)
        .maybeSingle();

      const categoryId = (base as any)?.category_id ?? null;
      const ids = lines.map((l) => l.product_id);

      // 2) Sugestões da mesma categoria (limite 8 pra ter folga após filtro).
      let q = supabase
        .from("products")
        .select("id, slug, name, price, sale_price, image_url, stock, category_id, is_featured")
        .eq("is_active", true)
        .gt("stock", 0)
        .not("id", "in", `(${ids.join(",")})`)
        .limit(8);
      if (categoryId) q = q.eq("category_id", categoryId);

      const { data: sameCat } = await q;
      let pool = ((sameCat as any[]) || []) as Suggestion[];

      // 3) Se sobraram menos de 4, completa com destaques de outras categorias.
      if (pool.length < 4) {
        const have = new Set([...ids, ...pool.map((p) => p.id)]);
        const { data: featured } = await supabase
          .from("products")
          .select("id, slug, name, price, sale_price, image_url, stock, category_id, is_featured")
          .eq("is_active", true)
          .eq("is_featured", true)
          .gt("stock", 0)
          .limit(8);
        for (const p of (featured as Suggestion[]) || []) {
          if (pool.length >= 4) break;
          if (!have.has(p.id)) pool.push(p);
        }
      }

      if (cancel) return;
      setItems(pool.slice(0, 4));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [cartKey]);

  if (lines.length === 0) return null;
  if (!loading && items.length === 0) return null;

  function quickAdd(p: Suggestion) {
    if (inCart.has(p.id) || (p.stock ?? 0) <= 0) return;
    const sale = p.sale_price != null ? Number(p.sale_price) : 0;
    const price = Number(p.price);
    const final = sale > 0 && sale < price ? sale : price;
    setAdding(p.id);
    add({
      product_id: p.id,
      slug: p.slug,
      name: p.name,
      price: final,
      image_url: p.image_url,
    });
    toast.success("Adicionado ao carrinho", { description: p.name });
    // pequeno feedback visual
    setTimeout(() => setAdding(null), 400);
  }

  return (
    <section className="mt-6 pt-5 border-t border-border" aria-label="Sugestões de produtos">
      <header className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-full bg-secondary/15 text-secondary inline-flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground leading-tight">
            Frequentemente comprado junto
          </h4>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Adicione com 1 toque
          </p>
        </div>
      </header>

      {loading ? (
        <ul className="grid grid-cols-2 gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-2">
              <div className="aspect-square rounded-lg skeleton-shimmer" />
              <div className="mt-2 h-3 w-4/5 rounded skeleton-shimmer" />
              <div className="mt-1.5 h-3 w-2/5 rounded skeleton-shimmer" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {items.map((p) => {
            const sale = p.sale_price != null ? Number(p.sale_price) : 0;
            const price = Number(p.price);
            const hasSale = sale > 0 && sale < price;
            const final = hasSale ? sale : price;
            const justAdded = adding === p.id;
            return (
              <li
                key={p.id}
                className="relative rounded-xl border border-border bg-card p-2 hover:border-primary/30 hover:shadow-sm transition-all animate-fade-in"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-white">
                  <img
                    src={imageUrl(p.image_url, { width: 200, quality: 75 })}
                    srcSet={`${imageUrl(p.image_url, { width: 200, quality: 75 })} 1x, ${imageUrl(p.image_url, { width: 400, quality: 75 })} 2x`}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                  {hasSale && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                      −{Math.round((1 - sale / price) * 100)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium leading-tight line-clamp-2 min-h-[2.1rem] text-foreground">
                  {p.name}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-1.5">
                  <span className="text-xs font-extrabold text-primary tabular-nums truncate">
                    {formatBRL(final)}
                  </span>
                  <button
                    type="button"
                    onClick={() => quickAdd(p)}
                    aria-label={`Adicionar ${p.name} ao carrinho`}
                    className={`h-7 w-7 inline-flex items-center justify-center rounded-full text-secondary-foreground shadow-sm shrink-0 transition-all active:scale-90 ${
                      justAdded ? "bg-success scale-110" : "bg-secondary hover:bg-secondary/90"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}