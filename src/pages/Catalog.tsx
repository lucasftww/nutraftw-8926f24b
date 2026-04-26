import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  category: { id: string; name: string; slug: string } | null;
}
interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { add, openCart } = useCart();

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("id, name, slug").order("display_order"),
        supabase
          .from("products")
          .select("id, slug, name, description, price, sale_price, image_url, is_featured, category:categories(id, name, slug)")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      setCategories((cats as any) || []);
      setProducts((prods as any) || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = products.filter((p) => {
    if (selectedCat && p.category?.slug !== selectedCat) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8 md:mb-12 text-center max-w-2xl mx-auto">
        <h1 className="font-display text-4xl md:text-5xl font-extrabold text-primary mb-3">
          Catálogo GIMPORTS
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Importados farmacêuticos com curadoria, preços transparentes e suporte dedicado.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="lg:sticky lg:top-24 self-start space-y-6">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Buscar
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Categorias
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCat(null)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedCat ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                Todas as categorias
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(c.slug)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCat === c.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section>
          {loading ? (
            <p className="text-center py-20 text-muted-foreground">A carregar catálogo…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border-2 border-dashed border-border bg-muted/20">
              <p className="text-muted-foreground mb-3">Nenhum produto encontrado.</p>
              <p className="text-sm text-muted-foreground">
                Adicione produtos no <Link to="/admin" className="text-primary font-semibold underline">painel admin</Link>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((p) => {
                const hasSale = p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price);
                const finalPrice = hasSale ? Number(p.sale_price) : Number(p.price);
                const discountPct = hasSale
                  ? Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100)
                  : 0;
                return (
                  <article key={p.id} className="product-card group relative">
                    {hasSale && (
                      <span className="absolute top-3 left-3 z-10 bg-secondary text-secondary-foreground text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full shadow">
                        Oferta -{discountPct}%
                      </span>
                    )}
                    <Link to={`/produto/${p.slug}`} className="aspect-square overflow-hidden bg-muted/30 block">
                      <img
                        src={p.image_url || "/assets/no-image.svg"}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                    <div className="p-4 flex flex-col flex-1">
                      {p.category && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-secondary mb-1">
                          {p.category.name}
                        </span>
                      )}
                      <h3 className="font-bold text-foreground text-base mb-1 line-clamp-2 leading-tight">
                        {p.name}
                      </h3>
                      <div className="mt-auto space-y-2 pt-3">
                        <div className="leading-tight">
                          {hasSale && (
                            <p className="text-xs text-muted-foreground line-through">{formatBRL(Number(p.price))}</p>
                          )}
                          <p className="font-display text-xl font-extrabold text-primary">
                            {formatBRL(finalPrice)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              add({
                                product_id: p.id,
                                slug: p.slug,
                                name: p.name,
                                price: finalPrice,
                                image_url: p.image_url,
                              });
                              openCart();
                            }}
                          >
                            Ao carrinho
                          </Button>
                          <Button asChild size="sm" className="w-full">
                            <Link to={`/produto/${p.slug}`}>Ver produto</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
