import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ShoppingCart, X, ArrowUpDown } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useProducts, useCategories, type ProductRow } from "@/hooks/useProducts";

type Product = ProductRow;

const SORT_KEYS = ["categoria", "recentes", "az"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABELS: Record<SortKey, string> = {
  categoria: "Por categoria",
  recentes: "Mais recentes",
  az: "A–Z",
};

export default function Catalog() {
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [] } = useCategories();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlCategoria = searchParams.get("categoria") ?? "";
  const urlSort = (searchParams.get("ordenar") ?? "categoria") as SortKey;
  const [query, setQuery] = useState(urlQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sort: SortKey = SORT_KEYS.includes(urlSort) ? urlSort : "categoria";

  // Infinite scroll — carrega incrementalmente para reduzir tempo inicial de render
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const setSort = (next: SortKey) => {
    const params = new URLSearchParams(searchParams);
    if (next === "categoria") params.delete("ordenar");
    else params.set("ordenar", next);
    setSearchParams(params, { replace: true });
  };

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

  // Reseta a paginação sempre que os critérios de listagem mudarem
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, selectedCats, sort]);

  const loading = loadingProducts;
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
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/produto/${p.slug}`,
        name: p.name,
      })),
    },
  });

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

  // Lista ordenada (usada quando o sort não é "categoria")
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "az") {
      arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    } else if (sort === "recentes") {
      arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return arr;
  }, [filtered, sort]);

  // Lista achatada para paginação no modo "categoria" (promos primeiro, depois cada categoria em ordem)
  const groupedFlat = useMemo(() => {
    const promos = filtered.filter((p) => {
      const pr = Number(p.price);
      const sp = p.sale_price != null ? Number(p.sale_price) : 0;
      return sp > 0 && sp < pr && Math.round((1 - sp / pr) * 100) >= 1;
    }).slice(0, 8);
    const byCat = new Map<string, { name: string; items: Product[] }>();
    for (const p of filtered) {
      if (!p.category?.slug) continue;
      const key = p.category.slug;
      const name = p.category.name;
      if (!byCat.has(key)) byCat.set(key, { name, items: [] });
      byCat.get(key)!.items.push(p);
    }
    return { promos, sections: Array.from(byCat.values()) };
  }, [filtered]);

  // Aplica o limite de visibilidade respeitando a ordem (promos → seções)
  const paginated = useMemo(() => {
    if (sort === "categoria") {
      let remaining = visibleCount;
      const promos = groupedFlat.promos.slice(0, remaining);
      remaining -= promos.length;
      const sections: { name: string; items: Product[] }[] = [];
      for (const s of groupedFlat.sections) {
        if (remaining <= 0) break;
        const items = s.items.slice(0, remaining);
        if (items.length > 0) sections.push({ name: s.name, items });
        remaining -= items.length;
      }
      return { promos, sections };
    }
    return { promos: [], sections: [{ name: SORT_LABELS[sort], items: sorted.slice(0, visibleCount) }] };
  }, [sort, sorted, groupedFlat, visibleCount]);

  const totalAvailable = useMemo(() => {
    if (sort === "categoria") {
      return groupedFlat.promos.length + groupedFlat.sections.reduce((acc, s) => acc + s.items.length, 0);
    }
    return sorted.length;
  }, [sort, sorted, groupedFlat]);

  const hasMore = visibleCount < totalAvailable;

  // IntersectionObserver para carregar mais ao se aproximar do fim da lista
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
    // Não dependemos de `paginated` aqui — ele é recriado a cada render
    // e estava recriando o observer toda vez (vazamento + flicker).
    // O updater de setVisibleCount já garante valor atual.
  }, [hasMore, loading]);

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
          {/* Search bar — mobile: ocupa toda a largura; controles abaixo */}
          <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                className="flex h-10 w-full rounded-full border border-input bg-background pl-10 pr-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Controles em grid no mobile (2 colunas iguais) */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <button
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {selectedCats.size > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {selectedCats.size}
                  </span>
                )}
              </button>
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Ordenar produtos"
                  className="appearance-none w-full h-10 pl-9 pr-7 rounded-full border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer"
                >
                  {SORT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {SORT_LABELS[k]}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</span>
              </div>
            </div>
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-card overflow-hidden">
                    <div className="aspect-square skeleton-shimmer rounded-2xl" />
                    <div className="pt-3 px-1 space-y-2">
                      <div className="h-3 w-4/5 skeleton-shimmer rounded" />
                      <div className="h-3 w-2/5 skeleton-shimmer rounded" />
                      <div className="h-9 w-full skeleton-shimmer rounded-full mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-muted/30 to-background">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-foreground font-semibold">Nenhum produto encontrado</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Tente remover filtros ou ajustar a busca.
                </p>
                {(selectedCats.size > 0 || query) && (
                  <button
                    onClick={() => {
                      setSelectedCats(new Set());
                      setQuery("");
                    }}
                    className="mt-4 inline-flex items-center justify-center h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                {sort === "categoria" ? (
                  <>
                    {paginated.promos.length > 0 && (
                      <Section title="Promoções" items={paginated.promos} onAdd={(p, price) => {
                        add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
                        openCart();
                      }} />
                    )}
                    {paginated.sections.map((s) => (
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
                ) : (
                  <Section
                    title={SORT_LABELS[sort]}
                    items={paginated.sections[0]?.items ?? []}
                    onAdd={(p, price) => {
                      add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
                      openCart();
                    }}
                  />
                )}
                {hasMore && (
                  <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 w-full">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-2xl bg-card overflow-hidden">
                          <div className="aspect-square skeleton-shimmer rounded-2xl" />
                          <div className="pt-3 px-1 space-y-2">
                            <div className="h-3 w-4/5 skeleton-shimmer rounded" />
                            <div className="h-3 w-2/5 skeleton-shimmer rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="mt-2 inline-flex items-center justify-center h-10 px-5 rounded-full border border-input bg-background text-sm font-semibold hover:bg-accent transition-colors"
                    >
                      Carregar mais
                    </button>
                  </div>
                )}
                {!hasMore && totalAvailable > PAGE_SIZE && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    Você viu todos os {totalAvailable} produtos.
                  </p>
                )}
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
                  className="flex-[1.4] h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary-glow shadow-md"
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
      <div className="mb-4 md:mb-8">
        <div className="flex items-center justify-between gap-3 border-b-2 border-primary/15 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className={`inline-block h-6 md:h-8 w-1 md:w-1.5 rounded-full shrink-0 ${
                isPromo ? "bg-secondary" : "bg-primary"
              }`}
            />
            <h2 className="text-lg md:text-3xl font-extrabold tracking-tight text-primary leading-none truncate">
              {title}
            </h2>
            {isPromo && (
              <span aria-hidden="true" className="text-base md:text-lg">🔥</span>
            )}
          </div>
          <span className="shrink-0 text-[11px] md:text-[13px] font-semibold text-muted-foreground tabular-nums">
            {items.length} {items.length === 1 ? "item" : "itens"}
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
              className={`group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-transparent hover:border-primary/15 ${isOut ? "opacity-70" : ""}`}
            >
              {/* Imagem */}
              <div className="relative aspect-square overflow-hidden bg-white rounded-2xl">
                <img
                  src={p.image_url || "/assets/no-image.svg"}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="w-full h-full object-cover"
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
                  className="mt-3 inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold bg-primary text-primary-foreground hover:bg-primary-glow rounded-full w-full text-xs h-9 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
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
