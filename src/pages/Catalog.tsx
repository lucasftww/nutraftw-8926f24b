import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { VitrineHero } from "@/components/vitrine/VitrineHero";

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
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);
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
      <VitrineHero />

      <div className="mx-auto w-full max-w-3xl px-4 mt-7 sm:mt-9">
        {/* Search + Filters bar */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-background border border-border text-[14px] shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary transition-colors"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-2 h-12 px-4 rounded-2xl bg-background border border-border text-[14px] font-semibold shadow-sm hover:border-primary/50 hover:text-primary transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {selectedCats.size > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {selectedCats.size}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {selectedCats.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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

        {/* Sections */}
        <div className="mt-7 pb-16 space-y-12">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-background border border-border/60 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3 w-4/5 bg-muted rounded" />
                    <div className="h-3 w-2/5 bg-muted rounded" />
                    <div className="h-9 w-full bg-muted rounded-xl mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 rounded-3xl border-2 border-dashed border-border bg-background">
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
            </>
          )}
        </div>
      </div>

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
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-[19px] sm:text-2xl font-extrabold text-foreground tracking-tight">
          {title}
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
            <article
              key={p.id}
              className="group flex flex-col rounded-2xl bg-background border border-border/60 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-lg hover:border-border transition-all"
            >
              <Link to={`/produto/${p.slug}`} className="relative block aspect-square bg-muted/40 overflow-hidden">
                <img
                  src={p.image_url || "/assets/no-image.svg"}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                />
                {hasRealSale && (
                  <span className="absolute top-2 right-2 rounded-md bg-success text-success-foreground text-[11px] font-bold px-1.5 py-0.5 shadow-sm">
                    -{discountPct}%
                  </span>
                )}
              </Link>

              <div className="flex flex-col flex-1 p-3.5">
                <Link to={`/produto/${p.slug}`} className="block">
                  <h3 className="font-semibold text-foreground text-[13.5px] leading-snug line-clamp-2 min-h-[36px]">
                    {p.name}
                  </h3>
                </Link>

                <div className="mt-2.5">
                  {hasRealSale && (
                    <div className="text-[11px] text-muted-foreground line-through leading-none">
                      {formatBRL(priceNum)}
                    </div>
                  )}
                  <div className="font-extrabold text-foreground text-[18px] leading-tight mt-0.5 tracking-tight">
                    {formatBRL(finalPrice)}
                  </div>
                </div>

                <button
                  onClick={() => onAdd(p, finalPrice)}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-glow active:scale-[0.98] transition-all shadow-sm"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
