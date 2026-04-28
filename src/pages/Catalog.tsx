import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  stock: number;
  created_at: string;
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
  const urlQuery = searchParams.get("q") ?? "";
  const urlCategoria = searchParams.get("categoria") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    if (urlCategoria) {
      setSelectedCats(new Set([urlCategoria]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCategoria]);
  useEffect(() => {
    if (query === urlQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      setSearchParams(params, { replace: true });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const [loading, setLoading] = useState(true);
  const { add, openCart } = useCart();

  useSEO({
    title: "GIMPORTS — Catálogo de farmacêuticos importados",
    description:
      "Catálogo GIMPORTS com produtos farmacêuticos importados: peptídeos, suporte e mais, com preços transparentes e envio para todo o Brasil.",
    type: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: products.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `/produto/${p.slug}`,
        name: p.name,
      })),
    },
  });

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("id, name, slug").order("display_order"),
        supabase
          .from("products")
          .select(
            "id, slug, name, description, price, sale_price, image_url, is_featured, stock, created_at, category:categories(id, name, slug)"
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

  const filtered = useMemo(
    () =>
      products.filter((p) => {
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
      }),
    [products, selectedCats, query]
  );

  // Group by category for the section style
  const grouped = useMemo(() => {
    const promos = filtered.filter((p) => {
      const pr = Number(p.price);
      const sp = p.sale_price != null ? Number(p.sale_price) : 0;
      return sp > 0 && sp < pr && Math.round((1 - sp / pr) * 100) >= 1;
    });
    const byCat = new Map<string, { name: string; items: Product[] }>();
    for (const p of filtered) {
      const key = p.category?.slug ?? "outros";
      const name = p.category?.name ?? "Outros";
      if (!byCat.has(key)) byCat.set(key, { name, items: [] });
      byCat.get(key)!.items.push(p);
    }
    return { promos, sections: Array.from(byCat.values()) };
  }, [filtered]);

  return (
    <>
      <div className="container mx-auto px-4 pt-6 md:pt-10 pb-1">
        <div className="w-full max-w-3xl mx-auto space-y-4">
          {/* Search + Filters bar (estilo CDE) */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {selectedCats.size > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {selectedCats.size}
                </span>
              )}
            </button>
          </div>

          {/* Active filter chips */}
          {selectedCats.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...selectedCats].map((slug) => {
                const c = categories.find((x) => x.slug === slug);
                if (!c) return null;
                return (
                  <button
                    key={slug}
                    onClick={() => toggleCat(slug)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                  >
                    {c.name}
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedCats(new Set())}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground self-center"
              >
                Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <section className="py-2">
        <div className="container mx-auto px-4">
          <div className="space-y-12 pb-16">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-card border shadow overflow-hidden animate-pulse">
                    <div className="aspect-square bg-muted" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-4/5 bg-muted rounded" />
                      <div className="h-3 w-2/5 bg-muted rounded" />
                      <div className="h-8 w-full bg-muted rounded mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 rounded-xl border-2 border-dashed border-border bg-background">
                <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
              </div>
            ) : (
              <>
                {grouped.promos.length > 0 && (
                  <Section title="Promoções" items={grouped.promos.slice(0, 8)} onAdd={(p, price) => {
                    add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
                    openCart();
                  }} />
                )}
                {grouped.sections.map((s) => (
                  <Section
                    key={s.name}
                    title={s.name}
                    items={s.items}
                    onAdd={(p, price) => {
                      add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
                      openCart();
                    }}
                  />
                ))}
                <div className="flex justify-center py-8" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Filters drawer (mobile + desktop) */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setFiltersOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-background shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Filtros</h2>
              </div>
              <button
                onClick={() => setFiltersOpen(false)}
                className="p-2 rounded-xl hover:bg-muted"
                aria-label="Fechar filtros"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Categorias
              </h3>
              <div className="flex flex-col gap-1">
                {categories.map((c) => {
                  const checked = selectedCats.has(c.slug);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 cursor-pointer h-11 px-3 rounded-xl hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCat(c.slug)}
                        className="sr-only"
                      />
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          checked ? "bg-primary border-primary" : "border-border bg-background"
                        }`}
                      >
                        {checked && (
                          <svg className="h-3 w-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={() => setSelectedCats(new Set())}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
              >
                Limpar
              </button>
              <button
                onClick={() => setFiltersOpen(false)}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow"
              >
                Ver resultados
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  items,
  onAdd,
}: {
  title: string;
  items: Product[];
  onAdd: (p: Product, finalPrice: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-5 md:mb-7">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground text-center">
          {title}
        </h2>
        <div className="mx-auto mt-2 h-px w-10 bg-border" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {items.map((p) => {
          const priceNum = Number(p.price);
          const saleNum = p.sale_price != null ? Number(p.sale_price) : 0;
          const discountPct =
            saleNum > 0 && saleNum < priceNum
              ? Math.round((1 - saleNum / priceNum) * 100)
              : 0;
          const hasRealSale = discountPct >= 1;
          const finalPrice = hasRealSale ? saleNum : priceNum;
          return (
            <Link
              key={p.id}
              to={`/produto/${p.slug}`}
              className="group flex flex-col h-full rounded-2xl bg-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Imagem */}
              <div className="relative aspect-square overflow-hidden bg-white rounded-2xl">
                <img
                  src={p.image_url || "/assets/no-image.svg"}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {hasRealSale && (
                  <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-foreground/90 text-background text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm">
                    -{discountPct}%
                  </span>
                )}
              </div>

              {/* Conteúdo */}
              <div className="pt-3 pb-1 px-1 flex-1 flex flex-col">
                <h3 className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">
                  {p.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-base md:text-lg font-bold text-foreground">
                    {formatBRL(finalPrice)}
                  </span>
                  {hasRealSale && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatBRL(priceNum)}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAdd(p, finalPrice);
                  }}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary-glow rounded-full w-full text-xs h-9"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
