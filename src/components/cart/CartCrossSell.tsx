import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { Plus, Sparkles } from "lucide-react";

/**
 * Cross-sell DENTRO do CartDrawer — sugere até 4 produtos da mesma
 * categoria dos itens já no carrinho, excluindo o que já está dentro.
 *
 * Aparece SOMENTE quando:
 *  - Carrinho tem 1–5 itens (acima disso vira ruído)
 *  - Há candidatos com estoque > 0 que não estão no carrinho
 *
 * Layout: horizontal scroll com mini-cards (compatível com drawer 420px).
 * Cada card tem um botão "+" overlay que adiciona ao carrinho sem fechar
 * o drawer — cliente vê item entrando, contador subindo, mantém momento.
 *
 * Performance:
 *  - 1 query simples (filter por categoria + exclude IDs + limit 4)
 *  - Memoiza por "ids dos itens do carrinho" — não re-busca a cada qty++
 */

interface Rec {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  stock: number;
}

export function CartCrossSell() {
  const { lines, add } = useCart();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);

  // Chave estável por conjunto de produtos no carrinho — não re-roda a cada
  // mudança de qty (que não afeta a recomendação).
  const productIdsKey = lines.map((l) => l.product_id).sort().join(",");

  useEffect(() => {
    const productIds = lines.map((l) => l.product_id).filter(Boolean);
    // Heurística de quando mostrar: apenas com 1-5 itens. 0 → cart vazio.
    // 6+ → cliente já decidiu, não atrapalhar.
    if (productIds.length === 0 || productIds.length > 5) {
      setRecs([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Pega categorias dos produtos no carrinho
        const { data: purchased } = await supabase
          .from("products")
          .select("category_id")
          .in("id", productIds);
        const categoryIds = Array.from(
          new Set(
            ((purchased || []) as Array<{ category_id: string | null }>)
              .map((p) => p.category_id)
              .filter(Boolean),
          ),
        ) as string[];
        if (categoryIds.length === 0) {
          if (!cancelled) { setRecs([]); setLoading(false); }
          return;
        }

        // Busca outros produtos das mesmas categorias
        const inList = productIds.map((id) => `"${id}"`).join(",");
        const { data } = await supabase
          .from("products")
          // Inclui stock no select — necessário para passar maxStock ao
          // cart store no clique "+", evitando que o cliente coloque mais
          // unidades do que o disponível.
          .select("id, slug, name, price, sale_price, image_url, stock")
          .eq("is_active", true)
          .in("category_id", categoryIds)
          .not("id", "in", `(${inList})`)
          .gt("stock", 0)
          .limit(4);

        if (cancelled) return;
        setRecs((data || []) as Rec[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productIdsKey]);

  if (loading || recs.length === 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-border bg-gradient-to-br from-primary/[0.04] to-secondary/[0.04] p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="h-3.5 w-3.5 text-secondary" strokeWidth={2.5} />
        <p className="text-[12px] font-bold text-foreground">
          Que tal incluir também?
        </p>
      </div>
      {/* Scroll horizontal — mais 1 card "espreitando" insinua continuação. */}
      <ul
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-thin"
        aria-label="Sugestões de produtos"
      >
        {recs.map((p) => {
          const sale = p.sale_price != null ? Number(p.sale_price) : 0;
          const price = Number(p.price);
          const hasSale = sale > 0 && sale < price;
          const final = hasSale ? sale : price;
          const r = responsiveImage(p.image_url, "120px", { fallbackWidth: 160 });
          return (
            <li
              key={p.id}
              className="shrink-0 w-[125px] snap-start rounded-lg bg-card border border-border/60 overflow-hidden"
            >
              <div className="relative aspect-square bg-white p-1.5 flex items-center justify-center">
                <img
                  src={r.src}
                  srcSet={r.srcSet || undefined}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  width={120}
                  height={120}
                  className="max-w-[90%] max-h-[90%] object-contain"
                />
                <button
                  type="button"
                  onClick={() => add(
                    {
                      product_id: p.id,
                      slug: p.slug,
                      name: p.name,
                      price: final,
                      image_url: p.image_url,
                    },
                    1,
                    p.stock ?? undefined,
                  )}
                  aria-label={`Adicionar ${p.name} ao carrinho`}
                  className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/90 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-medium leading-tight line-clamp-2 min-h-[2.2em] text-foreground">
                  {p.name}
                </p>
                <p className="text-[12px] font-extrabold text-success tabular-nums mt-0.5 leading-none">
                  {formatBRL(final * 0.95)}
                  <span className="ml-0.5 text-[8.5px] font-bold uppercase tracking-wider text-success/80 align-middle">
                    PIX
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
