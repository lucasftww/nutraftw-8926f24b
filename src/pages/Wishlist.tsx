import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

interface FavProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  stock: number;
}

export default function Wishlist() {
  const { isAuthed, ids } = useWishlist();
  const { user } = useAuth();
  const { add, openCart } = useCart();
  const [items, setItems] = useState<FavProduct[]>([]);
  const [loading, setLoading] = useState(true);

   useSEO({
     title: "Meus favoritos",
     description: "Produtos que você salvou para depois.",
   });

  useEffect(() => {
    if (!isAuthed) { setLoading(false); return; }
    if (ids.size === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    // Bug fix: sem flag de cancelamento, uma resposta antiga pode chegar
    // depois de uma nova (ex.: usuário remove favorito e re-favorita
    // rapidamente) e sobrescrever a lista correta com a obsoleta.
    let cancelled = false;
    supabase
      .from("products")
      .select("id, slug, name, price, sale_price, image_url, stock")
      .eq("is_active", true)
      .in("id", Array.from(ids))
      .then(({ data }) => {
        if (cancelled) return;
        setItems(((data as any) || []) as FavProduct[]);
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {items.map((p) => {
            const sale = p.sale_price != null ? Number(p.sale_price) : 0;
            const price = Number(p.price);
            const hasSale = sale > 0 && sale < price;
            const final = hasSale ? sale : price;
            const pixPrice = final * 0.95;
            const isOut = (p.stock ?? 0) <= 0;
            const r = responsiveImage(p.image_url, "(max-width: 640px) 50vw, 25vw", { fallbackWidth: 400 });
            return (
              <div
                key={p.id}
                className={`group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 ${isOut ? "opacity-70" : ""}`}
              >
                {/* p-5 sm:p-6 + object-contain — packshots farmacêuticos (caixas
                    verticais, frascos) ficavam cortados com object-cover. Mesma
                    convenção usada nos cards do Catalog. */}
                <Link to={`/produto/${p.slug}`} className="relative aspect-square overflow-hidden bg-white p-5 sm:p-6 flex items-center justify-center">
                  <img
                    src={r.src}
                    srcSet={r.srcSet || undefined}
                    sizes={r.sizes}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={400}
                    className="max-w-[85%] max-h-[85%] w-auto h-auto object-contain mx-auto transition-transform duration-500 group-hover:scale-105"
                  />
                  <WishlistButton productId={p.id} className="absolute top-2.5 right-2.5 z-[1] bg-white/90 hover:bg-white shadow-sm rounded-full" size="sm" />
                  {isOut && (
                    <span className="badge-pill absolute top-2.5 left-2.5 uppercase tracking-wide font-bold bg-foreground/85 text-background">
                      Esgotado
                    </span>
                  )}
                  {hasSale && !isOut && (
                    <span className="badge-pill absolute top-2.5 left-2.5 uppercase tracking-wide font-bold bg-secondary text-secondary-foreground">
                      −{Math.round((1 - sale / price) * 100)}%
                    </span>
                  )}
                </Link>
                <div className="flex flex-col flex-1 px-3 pt-2 pb-3 sm:px-3.5 sm:pt-3 sm:pb-4">
                  <Link
                    to={`/produto/${p.slug}`}
                    className="font-semibold text-[13px] sm:text-[14px] leading-snug text-foreground line-clamp-2 min-h-[2.8em] hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  {/* Hierarquia consistente com Catalog: PIX é o preço-âncora
                      (verde, dominante); preço normal vira referência. */}
                  <div className="mt-auto pt-2 leading-tight">
                    {hasSale && (
                      <div className="text-[11px] sm:text-[12px] text-oldPrice font-medium line-through tabular-nums opacity-80">
                        {formatBRL(price)}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[17px] sm:text-[20px] font-extrabold text-success tabular-nums tracking-tight leading-none">
                        {formatBRL(pixPrice)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-success/80 leading-none whitespace-nowrap">
                        no PIX
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-[12px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                      ou {formatBRL(final)}
                    </div>
                  </div>
                  {/* CTA h-11 (44px WCAG) — antes era h-10 (40px). */}
                  <button
                    onClick={() => { if (isOut) return; add({ product_id: p.id, slug: p.slug, name: p.name, price: final, image_url: p.image_url }); openCart(); }}
                    disabled={isOut}
                    aria-label={isOut ? `${p.name} esgotado` : `Adicionar ${p.name} ao carrinho`}
                    className="mt-3 btn-cta h-11 w-full !text-[13.5px] !gap-1.5 !px-0 disabled:opacity-40 disabled:!bg-muted disabled:!text-muted-foreground"
                  >
                    {isOut ? "Indisponível" : (<><ShoppingCart className="h-4 w-4" strokeWidth={2.2} />Comprar</>)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}