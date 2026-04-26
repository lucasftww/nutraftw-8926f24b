import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowRight, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
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
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const setQuery = (v: string) => {
    const params = new URLSearchParams(searchParams);
    if (v) params.set("q", v);
    else params.delete("q");
    setSearchParams(params, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const { add, openCart } = useCart();

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("id, name, slug").order("display_order"),
        supabase
          .from("products")
          .select(
            "id, slug, name, description, price, sale_price, image_url, is_featured, category:categories(id, name, slug)"
          )
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

  const toggleCat = (slug: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const filtered = products.filter((p) => {
    if (selectedCats.size > 0 && (!p.category || !selectedCats.has(p.category.slug)))
      return false;
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
    <main className="flex-1 flex flex-col">
      <section className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex-1">
        <div className="flex flex-col gap-3 mb-6 lg:mb-8">
          <h2 className="text-2xl font-bold text-foreground lg:hidden">Catálogo</h2>

          {/* Mobile search + chips */}
          <div className="lg:hidden flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full h-11 pl-9 pr-10 rounded-2xl border border-input bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
              <button
                onClick={() => setSelectedCats(new Set())}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  selectedCats.size === 0
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                Todas
              </button>
              {categories.map((c) => {
                const active = selectedCats.has(c.slug);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(c.slug)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                      active
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block sticky top-[100px] self-start space-y-6 bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-border/60 shadow-sm">
            <div className="flex items-center gap-2 pb-5 border-b border-border/50">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Filtros</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-sm text-foreground mb-3 uppercase tracking-wider">
                  Buscar produto
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome do produto..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-white text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border/50" />

              <div>
                <h3 className="font-bold text-sm text-foreground mb-3 uppercase tracking-wider">
                  Categorias
                </h3>
                <div className="space-y-3">
                  {categories.map((c) => {
                    const checked = selectedCats.has(c.slug);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCat(c.slug)}
                          className="sr-only"
                          aria-label={`Filtrar categoria ${c.name}`}
                        />
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-sm ${
                            checked
                              ? "bg-primary border-primary"
                              : "border-border group-hover:border-primary/50 bg-white"
                          }`}
                        >
                          {checked && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium leading-none transition-colors ${
                            checked
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {c.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedCats.size > 0 && (
                  <button
                    onClick={() => setSelectedCats(new Set())}
                    className="mt-4 text-xs font-semibold text-primary hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <section>
            {loading ? (
              <p className="text-center py-20 text-muted-foreground">A carregar catálogo…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border-2 border-dashed border-border bg-muted/20">
                <p className="text-muted-foreground mb-3">Nenhum produto encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6 items-stretch">
                {filtered.map((p) => {
                  const hasSale =
                    p.sale_price != null &&
                    Number(p.sale_price) > 0 &&
                    Number(p.sale_price) < Number(p.price);
                  const finalPrice = hasSale ? Number(p.sale_price) : Number(p.price);
                  return (
                    <div key={p.id} className="flex">
                      <article className="product-card group">
                        <div className="relative aspect-square overflow-hidden bg-muted/30 flex-shrink-0">
                          <Link to={`/produto/${p.slug}`}>
                            <img
                              src={p.image_url || "/assets/no-image.svg"}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </Link>
                          {hasSale && (
                            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-destructive text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded-full shadow-lg">
                              OFERTA
                            </div>
                          )}
                          {p.is_featured && (
                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-secondary text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded-full shadow-lg">
                              LANÇAMENTO
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex flex-col flex-1">
                          {p.category && (
                            <div className="mb-1 text-xs font-semibold text-secondary tracking-wider uppercase">
                              {p.category.name}
                            </div>
                          )}
                          <h3 className="font-bold text-foreground text-base mb-1 line-clamp-2 leading-tight">
                            {p.name}
                          </h3>
                          {p.description && (
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                              {p.description}
                            </p>
                          )}

                          <div className="mt-auto">
                            <div className="flex flex-col mb-3">
                              {hasSale && (
                                <span className="text-xs text-muted-foreground line-through decoration-destructive/50">
                                  {formatBRL(Number(p.price))}
                                </span>
                              )}
                              <span className="font-bold text-xl text-primary">
                                {formatBRL(finalPrice)}
                              </span>
                            </div>

                            <div className="flex flex-col gap-2">
                              <Link
                                to={`/produto/${p.slug}`}
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 border border-primary/20 h-10 sm:h-12 px-3 sm:px-6 font-medium w-full rounded-xl text-xs sm:text-sm"
                              >
                                Ver produto
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                              <button
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
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 h-10 sm:h-12 px-3 sm:px-6 font-medium w-full rounded-xl text-xs sm:text-sm"
                              >
                                <ShoppingCart className="w-4 h-4 shrink-0" />
                                <span className="sm:hidden">Comprar</span>
                                <span className="hidden sm:inline xl:hidden">Adicionar</span>
                                <span className="hidden xl:inline">Adicionar ao carrinho</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
