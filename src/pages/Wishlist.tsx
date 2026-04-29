import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
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
    title: "Meus favoritos | GIMPORTS",
    description: "Produtos que você salvou para depois.",
  });

  useEffect(() => {
    if (!isAuthed) { setLoading(false); return; }
    if (ids.size === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("products")
      .select("id, slug, name, price, sale_price, image_url, stock")
      .eq("is_active", true)
      .in("id", Array.from(ids))
      .then(({ data }) => {
        setItems(((data as any) || []) as FavProduct[]);
        setLoading(false);
      });
  }, [isAuthed, ids.size]);

  if (!isAuthed) {
    return (
      <section className="container mx-auto px-4 py-16 text-center max-w-md">
        <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Heart className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Seus favoritos esperam</h1>
        <p className="text-muted-foreground mb-6">Entre para salvar produtos e voltar quando quiser.</p>
        <Link
          to="/login?redirect=/favoritos"
          className="inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold"
        >
          Entrar
        </Link>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8 md:py-10">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary flex items-center gap-2">
            <Heart className="h-6 w-6 fill-current text-destructive" />
            Meus favoritos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "produto salvo" : "produtos salvos"}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card overflow-hidden">
              <div className="aspect-square skeleton-shimmer rounded-2xl" />
              <div className="pt-3 space-y-2"><div className="h-3 w-4/5 skeleton-shimmer rounded" /><div className="h-3 w-2/5 skeleton-shimmer rounded" /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum produto favoritado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Toque no coração nos produtos para salvar aqui.</p>
          <Link to="/" className="mt-5 inline-flex items-center h-10 px-5 rounded-full border border-border text-sm font-semibold hover:bg-foreground hover:text-background transition-colors">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {items.map((p) => {
            const sale = p.sale_price != null ? Number(p.sale_price) : 0;
            const price = Number(p.price);
            const hasSale = sale > 0 && sale < price;
            const final = hasSale ? sale : price;
            const isOut = (p.stock ?? 0) <= 0;
            const r = responsiveImage(p.image_url, "(max-width: 640px) 50vw, 25vw", { fallbackWidth: 400 });
            return (
              <div key={p.id} className={`group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-card)] transition-all ${isOut ? "opacity-70" : ""}`}>
                <Link to={`/produto/${p.slug}`} className="relative aspect-square overflow-hidden bg-white block">
                  <img src={r.src} srcSet={r.srcSet || undefined} sizes={r.sizes} alt={p.name} loading="lazy" decoding="async" width={400} height={400} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  <WishlistButton productId={p.id} className="absolute top-2 right-2" size="sm" />
                </Link>
                <div className="pt-3 pb-3 px-2.5 flex-1 flex flex-col">
                  <Link to={`/produto/${p.slug}`} className="font-medium text-[13px] sm:text-sm leading-snug line-clamp-2 min-h-[2.4rem] text-foreground hover:text-primary">{p.name}</Link>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {hasSale && <span className="text-[11px] text-muted-foreground line-through tabular-nums">de {formatBRL(price)}</span>}
                    <span className="text-base md:text-lg font-extrabold text-primary tabular-nums">{formatBRL(final)}</span>
                  </div>
                  <button
                    onClick={() => { if (isOut) return; add({ product_id: p.id, slug: p.slug, name: p.name, price: final, image_url: p.image_url }); openCart(); }}
                    disabled={isOut}
                    className="mt-2.5 inline-flex items-center justify-center gap-1.5 font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90 active:scale-[0.98] transition-all rounded-full w-full text-xs h-10 disabled:opacity-40 disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {isOut ? "Esgotado" : (<><ShoppingCart className="h-3.5 w-3.5" />Comprar</>)}
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