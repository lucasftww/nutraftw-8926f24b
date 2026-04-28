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

  // Contagem de produtos por categoria (para mostrar no filtro)
  const countByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const k = p.category?.slug;
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [products]);

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
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filtros do catálogo">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px] animate-in fade-in"
            onClick={() => setFiltersOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[92%] max-w-md bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header — grande, claro, com contador */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-xl text-primary leading-tight">Filtros</h2>
                  <p className="text-[13px] text-muted-foreground leading-tight">
                    {selectedCats.size === 0
                      ? "Toque para escolher uma categoria"
                      : `${selectedCats.size} ${selectedCats.size === 1 ? "categoria selecionada" : "categorias selecionadas"}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFiltersOpen(false)}
                className="h-11 w-11 inline-flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
                aria-label="Fechar filtros"
              >
                <X className="h-6 w-6 text-primary" />
              </button>
            </div>

            {/* Lista de categorias — área de toque ampla, contagem visível */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-center justify-between px-2 mb-3">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                  Categorias
                </h3>
                {selectedCats.size > 0 && (
                  <button
                    onClick={() => setSelectedCats(new Set())}
                    className="text-[13px] font-semibold text-primary hover:underline"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {categories.map((c) => {
                  const checked = selectedCats.has(c.slug);
                  const count = countByCat.get(c.slug) ?? 0;
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex items-center gap-4 cursor-pointer min-h-[56px] px-4 rounded-2xl border transition-all ${
                          checked
                            ? "bg-primary/5 border-primary/40 shadow-sm"
                            : "bg-background border-border hover:bg-muted/60 hover:border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCat(c.slug)}
                          className="sr-only"
                        />
                        <div
                          className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            checked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                          }`}
                          aria-hidden="true"
                        >
                          {checked && (
                            <svg
                              className="h-4 w-4 text-primary-foreground"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span
                          className={`flex-1 text-base font-medium ${
                            checked ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {c.name}
                        </span>
                        <span
                          className={`text-[13px] font-semibold tabular-nums px-2.5 py-0.5 rounded-full ${
                            checked
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Rodapé com CTA grande */}
            <div className="px-4 py-4 border-t border-border bg-background shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.08)]">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCats(new Set())}
                  className="flex-1 h-14 rounded-2xl border-2 border-border text-base font-semibold text-foreground hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="flex-[1.4] h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary-glow active:scale-[0.98] transition-all shadow-md"
                >
                  Ver {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
                </button>
              </div>
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
  const isPromo = /promo/i.test(title);
  return (
    <div>
      <div className="mb-6 md:mb-8">
        <div className="flex items-end justify-between gap-4 border-b-2 border-primary/15 pb-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`inline-block h-7 md:h-8 w-1.5 rounded-full ${
                isPromo ? "bg-secondary" : "bg-primary"
              }`}
            />
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary leading-none">
              {title}
            </h2>
            {isPromo && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-secondary text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 shadow-sm animate-pulse">
                🔥 Ofertas
              </span>
            )}
          </div>
          <span className="shrink-0 text-[12px] md:text-[13px] font-semibold text-muted-foreground tabular-nums">
            {items.length} {items.length === 1 ? "produto" : "produtos"}
          </span>
        </div>
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
          const isOut = (p.stock ?? 0) <= 0;
          const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
          const isNew = !isOut && ageDays <= 30;
          const badge = isOut
            ? { label: "ESGOTADO", cls: "bg-destructive text-destructive-foreground" }
            : hasRealSale
            ? { label: "OFERTA", cls: "bg-secondary text-white" }
            : isNew
            ? { label: "LANÇAMENTO", cls: "bg-emerald-600 text-white" }
            : p.is_featured
            ? { label: "DESTAQUE", cls: "bg-primary text-primary-foreground" }
            : null;
          return (
            <Link
              key={p.id}
              to={`/produto/${p.slug}`}
              className={`group flex flex-col h-full rounded-2xl bg-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${isOut ? "opacity-70" : ""}`}
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
                {badge && (
                  <span className={`absolute top-2 left-2 inline-flex items-center rounded-full text-[10px] font-bold tracking-wide px-2 py-0.5 shadow-sm ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
                {hasRealSale && !isOut && (
                  <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-foreground/90 text-background text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm">
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
                    if (isOut) return;
                    onAdd(p, finalPrice);
                  }}
                  disabled={isOut}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary-glow rounded-full w-full text-xs h-9 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {isOut ? "Esgotado" : "Adicionar"}
                </button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
