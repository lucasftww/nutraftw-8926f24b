import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { Sparkles } from "lucide-react";

/**
 * Recomendações pós-compra — exibe 3-4 produtos da MESMA categoria
 * dos itens comprados, excluindo o que já foi adquirido. Aparece DEPOIS
 * do checkout (no CustomerOrderDetail) para sugerir a próxima compra.
 *
 * Estratégia simples (V1): pega categorias dos items recebidos, busca
 * outros produtos ativos dessas categorias.
 *
 * Limita a 4 itens (cabe em 1 linha desktop / 2x2 grid mobile).
 */

interface Item {
  product_id?: string | null;
  product_name?: string | null;
}

interface Recommended {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
}

export function PostPurchaseRecommendations({ items }: { items: Item[] }) {
  const [recs, setRecs] = useState<Recommended[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const productIds = items.map((i) => i.product_id).filter(Boolean) as string[];
    if (productIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // 1. Pega categorias dos produtos comprados
        const { data: purchased } = await supabase
          .from("products")
          .select("category_id")
          .in("id", productIds);
        const categoryIds = Array.from(
          new Set(((purchased || []) as Array<{ category_id: string | null }>).map((p) => p.category_id).filter(Boolean)),
        ) as string[];
        if (categoryIds.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // 2. Busca outros produtos das mesmas categorias (excluindo os comprados)
        const { data } = await supabase
          .from("products")
          .select("id, slug, name, price, sale_price, image_url")
          .eq("is_active", true)
          .in("category_id", categoryIds)
          .not("id", "in", `(${productIds.map((id) => `"${id}"`).join(",")})`)
          .gt("stock", 0)
          .limit(4);

        if (cancelled) return;
        setRecs((data || []) as Recommended[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [items]);

  if (loading) return null;
  if (recs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-secondary/[0.03] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-secondary" strokeWidth={2.5} />
        <h3 className="font-bold text-sm">Você também pode gostar</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {recs.map((p) => {
          const sale = p.sale_price != null ? Number(p.sale_price) : 0;
          const price = Number(p.price);
          const hasSale = sale > 0 && sale < price;
          const final = hasSale ? sale : price;
          const r = responsiveImage(p.image_url, "(max-width: 640px) 50vw, 25vw", { fallbackWidth: 240 });
          return (
            <Link
              key={p.id}
              to={`/produto/${p.slug}`}
              className="group flex flex-col rounded-xl bg-card border border-border/60 overflow-hidden hover:border-secondary/40 hover:shadow-sm transition-all"
            >
              <div className="aspect-square bg-white p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={r.src}
                  srcSet={r.srcSet || undefined}
                  sizes={r.sizes}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  width={240}
                  height={240}
                  className="max-w-[90%] max-h-[90%] object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-2 pt-1.5">
                <p className="text-[11px] sm:text-[12px] font-medium leading-tight line-clamp-2 min-h-[2.4em]">
                  {p.name}
                </p>
                <p className="text-[12px] sm:text-[13px] font-extrabold text-success tabular-nums leading-none mt-1">
                  {formatBRL(final * 0.95)}
                  <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-success/80 align-middle">
                    PIX
                  </span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
