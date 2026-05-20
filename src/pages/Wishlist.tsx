import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductRow } from "@/hooks/useProducts";

export default function Wishlist() {
  const { isAuthed, ids } = useWishlist();
  const { add, openCart } = useCart();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Handler estável para adicionar ao carrinho — passado ao ProductCard.
  // Passa `maxStock` para evitar adicionar além do estoque (bug fix).
  const handleAdd = useCallback((p: ProductRow, finalPrice: number) => {
    add({ product_id: p.id, slug: p.slug, name: p.name, price: finalPrice, image_url: p.image_url }, 1, p.stock ?? undefined);
    openCart();
  }, [add, openCart]);

   useSEO({
     title: "Meus favoritos",
     description:
       "Sua lista de produtos favoritos da Royal Vitta — salve itens para comparar, acompanhar promoções e finalizar a compra quando quiser.",
     robots: "noindex,follow",
   });

  useEffect(() => {
    if (!isAuthed) { setLoading(false); return; }
    if (ids.size === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    // Bug fix: sem flag de cancelamento, uma resposta antiga pode chegar
    // depois de uma nova (ex.: usuário remove favorito e re-favorita
    // rapidamente) e sobrescrever a lista correta com a obsoleta.
    let cancelled = false;
    // Seleciona todos os campos necessários para o ProductCard reusado.
    supabase
      .from("products")
      .select("id, slug, name, price, sale_price, image_url, stock, created_at, is_new_release, is_on_offer, category_id, brand_id")
      .eq("is_active", true)
      .in("id", Array.from(ids))
      .then(({ data }) => {
        if (cancelled) return;
        setItems(((data as any) || []) as ProductRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
    // Bug fix: depender só de `ids.size` não detecta troca de itens com
    // o mesmo total (ex.: remover A e adicionar B). Usamos uma chave
    // ordenada e estável dos IDs — re-busca SOMENTE quando o conjunto muda.
  }, [isAuthed, Array.from(ids).sort().join(",")]);

  if (!isAuthed) {
    return (
      <section className="container mx-auto px-4 py-16 text-center max-w-md animate-fade-in">
        <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-destructive/10 text-destructive flex items-center justify-center animate-scale-in">
          <Heart className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Seus favoritos te esperam</h1>
        <p className="text-muted-foreground mb-6">Faça login para salvar produtos e encontrá-los em qualquer dispositivo.</p>
        <Link
          to="/login?next=/favoritos"
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          Entrar agora <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8 md:py-10">
      <header className="flex items-end justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
            <Heart className="h-6 w-6 fill-current text-destructive" />
            Meus favoritos
          </h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">
              {items.length === 0
                ? "Sua lista está vazia por enquanto"
                : `${items.length} ${items.length === 1 ? "produto salvo" : "produtos salvos"}`}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5" aria-busy="true" aria-label="Carregando favoritos">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card overflow-hidden border border-border/40">
              <div className="aspect-square skeleton-shimmer" />
              <div className="pt-3 pb-3 px-2.5 space-y-2">
                <div className="h-3 w-4/5 skeleton-shimmer rounded" />
                <div className="h-3 w-3/5 skeleton-shimmer rounded" />
                <div className="h-4 w-2/5 skeleton-shimmer rounded mt-2" />
                <div className="h-9 w-full skeleton-shimmer rounded-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-base">Sua lista de favoritos está vazia</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
            Toque no coração de qualquer produto para guardá-lo aqui e finalizar a compra depois.
          </p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all">
            Explorar catálogo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        // Reusa o ProductCard do Catalog (mesmo layout/regras de badge/preço).
        // Antes a Wishlist mantinha uma cópia local que ia divergindo (ex.:
        // não exibia LANÇAMENTO/OFERTA e o badge "Esgotado" era preto, não
        // vermelho). Agora as duas listas ficam sempre consistentes.
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} onAdd={handleAdd} />
          ))}
        </div>
      )}
    </section>
  );
}