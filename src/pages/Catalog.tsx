import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { responsiveImage, imageUrl } from "@/lib/image";
import { prefetchImage, shouldPrefetch } from "@/lib/prefetch";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { Search, SlidersHorizontal, X, ArrowUpDown, ShoppingCart } from "lucide-react";
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

// Helpers puros — declarados fora do componente para não serem recriados
// a cada render do Catalog (entram nas deps de useMemo abaixo).

/** Score de "atratividade" de venda — tie-breaker dentro das categorias. */
const productScore = (p: ProductRow) => {
  const inStock = (p.stock ?? 0) > 0 ? 1 : 0;
  const featured = p.is_featured ? 1 : 0;
  const recency = new Date(p.created_at).getTime();
  return inStock * 1e15 + featured * 1e13 + recency;
};

/** % de desconto (0 quando não há promoção real). */
const discountPctOf = (p: ProductRow) => {
  const pr = Number(p.price);
  const sp = p.sale_price != null ? Number(p.sale_price) : 0;
  if (!(sp > 0 && sp < pr)) return 0;
  return (pr - sp) / pr;
};

const isTirzepatidaCategory = (c: { name?: string | null; slug?: string | null }) => {
  const value = `${c.name ?? ""} ${c.slug ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return value.includes("tirzepatida") || value.includes("tirze") || value.includes("tizer");
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
    // Sincroniza URL → state em AMBAS as direções:
    // - `?categoria=peptideos`  → seleciona só essa categoria
    // - sem `?categoria=...`    → limpa o filtro (antes ficava preso ao
    //   navegar para `/` depois de uma categoria, exigindo recarregar a página).
    setSelectedCats(urlCategoria ? new Set([urlCategoria]) : new Set());
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

  // Drawer de filtros: ESC fecha + trava scroll do body enquanto aberto.
  // Mesmo comportamento do CartDrawer para consistência de UX/A11y.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const loading = loadingProducts;
  const { add, openCart } = useCart();
  const qc = useQueryClient();

  // Pré-carrega o produto quando o usuário sinaliza intenção (hover/touchstart no card).
  // Curto-circuito quando já há dado fresco em cache: evita disparar a mesma
  // query várias vezes a cada re-render (ex.: digitando na busca, hover/touch
  // repetidos). React Query também dedupe in-flight, mas checar `getQueryState`
  // antes nos poupa o trabalho de criar a Promise/observers.
  const prefetchProduct = useCallback((slug: string) => {
    if (!slug) return;
    const key = queryKeys.products.detail(slug);
    const state = qc.getQueryState(key);
    if (state?.data && state.dataUpdatedAt && Date.now() - state.dataUpdatedAt < 60_000) {
      return; // já temos dado fresco — não há motivo para refazer a chamada
    }
    qc.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("products")
          .select("*, category:categories(name, slug)")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      staleTime: 60_000,
    });
  }, [qc]);

  // Prefetch combinado: dados do produto + imagem hero hi-res (a mesma variante
  // usada na ProductDetail). Disparado quando o card entra na viewport ou o
  // usuário sinaliza intenção (touchstart/hover).
  //
  // Dedup por slug durante a sessão da página: ao digitar na busca, a lista
  // filtrada é recriada e cada `ProductCard` monta um novo IntersectionObserver
  // — sem este Set, todo card já visível dispararia prefetch de novo a cada
  // tecla. `prefetchImage` já é idempotente (cache interno), então a economia
  // aqui é em `prefetchProduct` + chamadas a `imageUrl()`.
  const fullPrefetchedRef = useRef<Set<string>>(new Set());
  const prefetchProductFull = useCallback(
    (p: Product) => {
      if (!shouldPrefetch()) return;
      if (fullPrefetchedRef.current.has(p.slug)) return;
      fullPrefetchedRef.current.add(p.slug);
      prefetchProduct(p.slug);
      // Casa com responsiveImage(..., { fallbackWidth: 800, quality: 80 }) na ProductDetail
      prefetchImage(imageUrl(p.image_url, { width: 800, quality: 80 }));
    },
    [prefetchProduct]
  );

  // Handler estável para "Adicionar ao carrinho" no card → evita re-render dos cards.
  const handleAdd = useCallback((p: Product, price: number) => {
    add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
    openCart();
  }, [add, openCart]);

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
    () => {
      // Normaliza para busca tolerante: remove acentos, pontuação (`.`, `-`, `/`, `_`)
      // e colapsa espaços. Assim "tg" encontra "T.G.", "amox 500" encontra
      // "Amoxicilina-500", "vit b12" encontra "Vitamina B12", etc.
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove acentos
          .replace(/[^\p{L}\p{N}]+/gu, " ") // pontuação/símbolos viram espaço
          .trim()
          .replace(/\s+/g, " ");
      // Versão "compacta" (sem espaços) — usada como segunda chance, para
      // que "tg" case com "t g" (que veio de "T.G.").
      const compact = (s: string) => normalize(s).replace(/\s+/g, "");

      const qNorm = query ? normalize(query) : "";
      const qCompact = query ? compact(query) : "";

      return products.filter((p) => {
        if (selectedCats.size > 0) {
          // "__promos__" é uma pseudo-categoria: produtos com desconto real.
          // Quando combinada com categorias reais, aplicamos INTERSEÇÃO
          // (produto da categoria X que também está em promoção). Isso evita
          // o bug em que marcar "Promoções + Tirzepatida" listava qualquer
          // promo de qualquer categoria misturada com produtos full-price
          // de Tirzepatida.
          const wantsPromos = selectedCats.has("__promos__");
          const realCats = new Set(
            [...selectedCats].filter((s) => s !== "__promos__")
          );
          if (wantsPromos && discountPctOf(p) <= 0) return false;
          if (realCats.size > 0) {
            if (!p.category || !realCats.has(p.category.slug)) return false;
          } else if (!wantsPromos) {
            return false;
          }
        }
        if (!qNorm) return true;
        const nameNorm = normalize(p.name);
        const descNorm = p.description ? normalize(p.description) : "";
        if (nameNorm.includes(qNorm) || descNorm.includes(qNorm)) return true;
        // Segunda passada sem espaços: "tg" → casa em "tg" dentro de
        // compact("T.G. 500mg") = "tg500mg".
        const nameCompact = nameNorm.replace(/\s+/g, "");
        const descCompact = descNorm.replace(/\s+/g, "");
        return nameCompact.includes(qCompact) || descCompact.includes(qCompact);
      });
    },
    [products, selectedCats, query]
  );

  // Comparator único — usado tanto em Promoções quanto em cada Categoria,
  // garantindo que "A→Z" e "Recentes" se apliquem em TODAS as seções da
  // mesma forma. "Por categoria" mantém a curadoria comercial
  // (% desconto desc → score desc) como tie-breaker de conversão.
  const sortComparator = useMemo(() => {
    if (sort === "az") {
      return (a: Product, b: Product) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    }
    if (sort === "recentes") {
      return (a: Product, b: Product) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // "categoria" (curadoria): mais desconto primeiro, desempate por score
    return (a: Product, b: Product) => {
      const dDiff = discountPctOf(b) - discountPctOf(a);
      if (Math.abs(dDiff) > 0.0001) return dDiff;
      return productScore(b) - productScore(a);
    };
  }, [sort]);

  // Agrupamento estável: Promoções no topo (todas as promos, sem teto fixo)
  // e cada Categoria abaixo. Mesmo comparator em todas as seções.
  const grouped = useMemo(() => {
    // Quando o usuário ordena por "A-Z" ou "Recentes", a expectativa é
    // ver TODOS os produtos numa única lista plana ordenada — não faz
    // sentido manter agrupamento por categoria nesses sorts.
    const flat = sort !== "categoria";
    const promos = flat
      ? []
      : filtered.filter((p) => discountPctOf(p) > 0).sort(sortComparator);
    const showOnlyPromos =
      !flat && selectedCats.size === 1 && selectedCats.has("__promos__");

    if (flat) {
      const items = [...filtered].sort(sortComparator);
      return {
        promos,
        sections: items.length
          ? [{ slug: "__all__", name: "Todos os produtos", items }]
          : [],
        showOnlyPromos: false,
      };
    }

    const categoryIndex = new Map(categories.map((c, index) => [c.slug, index]));
    const byCat = new Map<string, { slug: string; name: string; items: Product[] }>();
    // Bucket fallback para produtos sem categoria — antes eram silenciosamente
    // descartados quando o sort era "categoria", causando divergência entre o
    // contador "Ver N produtos" e o que de fato aparecia na grade.
    const ORPHAN_KEY = "__sem-categoria__";
    for (const p of showOnlyPromos ? [] : filtered) {
      const key = p.category?.slug ?? ORPHAN_KEY;
      const name = p.category?.name ?? "Outros produtos";
      if (!byCat.has(key)) byCat.set(key, { slug: key, name, items: [] });
      byCat.get(key)!.items.push(p);
    }
    for (const s of byCat.values()) s.items.sort(sortComparator);

    const sections = Array.from(byCat.values()).sort((a, b) => {
      // Órfãos sempre por último.
      const aOrphan = a.slug === ORPHAN_KEY ? 1 : 0;
      const bOrphan = b.slug === ORPHAN_KEY ? 1 : 0;
      if (aOrphan !== bOrphan) return aOrphan - bOrphan;
      const aTirz = isTirzepatidaCategory(a) ? 0 : 1;
      const bTirz = isTirzepatidaCategory(b) ? 0 : 1;
      if (aTirz !== bTirz) return aTirz - bTirz;
      return (categoryIndex.get(a.slug) ?? 999) - (categoryIndex.get(b.slug) ?? 999);
    });

    return { promos, sections, showOnlyPromos };
  }, [categories, filtered, selectedCats, sortComparator, sort]);

  // Sem paginação: mostra TODAS as promoções e TODOS os produtos de TODAS as
  // categorias de uma vez. Performance é mantida via `content-visibility:auto`
  // nas seções (ver componente <Section/>) e lazy-loading das imagens.
  const paginated = grouped;

  // Contagem de produtos por categoria (para mostrar no filtro)
  const countByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const k = p.category?.slug;
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    // Pseudo-categoria "Promoções": conta produtos com desconto real.
    const promoCount = products.reduce((acc, p) => acc + (discountPctOf(p) > 0 ? 1 : 0), 0);
    map.set("__promos__", promoCount);
    return map;
  }, [products]);

  return (
    <>
      {/* Barra sticky única: busca + chips de categoria juntos.
          - Cola direto no header (sem padding top extra) para eliminar
            o espaço vazio entre header e conteúdo.
          - Chips logo abaixo da busca formam a "barra de filtros"
            principal, sempre visível durante o scroll. */}
      <div className="sticky top-12 md:top-14 z-20 bg-background border-b border-border/40 pt-1.5 md:pt-2 pb-1.5 md:pb-2">
        <div className="container mx-auto px-4">
          <div className="w-full max-w-3xl mx-auto space-y-2">
          {/* Linha 1: busca + ícone de filtros (drawer com ordenação e
              multi-seleção avançada). Mais limpa: 1 input grande + 1 ícone. */}
          <div className="flex gap-2">
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
            <button
              onClick={() => setFiltersOpen(true)}
              aria-label="Filtros e ordenação"
              className="relative inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-full border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(selectedCats.size > 0 || sort !== "categoria") && (
                <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
          </div>

          {/* Linha 2: chips horizontais de categoria — pill ativo sólido
              azul-marinho, inativos com borda discreta (estilo da referência). */}
          <div
            role="tablist"
            aria-label="Categorias"
            className="-mx-4 px-4 flex gap-2 overflow-x-auto scroll-smooth snap-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {(() => {
              const promoCount = countByCat.get("__promos__") ?? 0;
              const allActive = selectedCats.size === 0;
              const chips: { key: string; label: string; active: boolean; onClick: () => void }[] = [
                {
                  key: "__all__",
                  label: "Todas",
                  active: allActive,
                  onClick: () => setSelectedCats(new Set()),
                },
                ...[...categories]
                  .sort((a, b) => {
                    const aTirz = isTirzepatidaCategory(a) ? 0 : 1;
                    const bTirz = isTirzepatidaCategory(b) ? 0 : 1;
                    if (aTirz !== bTirz) return aTirz - bTirz;
                    return 0;
                  })
                  .map((c) => ({
                    key: c.slug,
                    label: c.name,
                    active: selectedCats.size === 1 && selectedCats.has(c.slug),
                    onClick: () => setSelectedCats(new Set([c.slug])),
                  })),
              ];
              return chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  role="tab"
                  aria-pressed={chip.active}
                  onClick={chip.onClick}
                  className={`shrink-0 snap-start inline-flex items-center justify-center h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                    chip.active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "bg-background text-foreground/70 border border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {chip.label}
                </button>
              ));
            })()}
          </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <section className="relative pt-3 md:pt-4 pb-2 scroll-mt-32">
        <div className="container mx-auto px-4">
          {/* overflow-anchor:none impede o navegador de "puxar" o scroll
              quando novos cards são inseridos pelo infinite scroll —
              evita a sensação de a página subir sozinha no mobile. */}
          <div className="space-y-6 md:space-y-10 pb-16 [overflow-anchor:none]">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-card overflow-hidden">
                    <div className="aspect-square skeleton-shimmer" />
                    <div className="pt-3 pb-3 px-3 space-y-2">
                      <div className="h-3 w-4/5 skeleton-shimmer rounded" />
                      <div className="h-4 w-2/5 skeleton-shimmer rounded mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <Search className="h-5 w-5 mx-auto mb-3 text-muted-foreground" />
                <p className="text-foreground font-medium">Nenhum produto encontrado</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Tente remover filtros ou ajustar a busca.
                </p>
                {(selectedCats.size > 0 || query) && (
                  <button
                    onClick={() => {
                      setSelectedCats(new Set());
                      setQuery("");
                    }}
                    className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-full border border-border text-foreground text-sm font-medium hover:bg-foreground hover:text-background transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Layout uniforme: Promoções + TODAS as categorias com TODOS
                    os produtos visíveis de uma vez (sem paginação). */}
                {paginated.promos.length > 0 && (
                  <Section
                    title="Promoções"
                    items={paginated.promos}
                    onAdd={handleAdd}
                    onPrefetch={prefetchProduct}
                    onPrefetchFull={prefetchProductFull}
                  />
                )}
                {paginated.sections.map((s) => (
                  <Section
                    key={s.name}
                    title={s.name}
                    items={s.items}
                    onAdd={handleAdd}
                    onPrefetch={prefetchProduct}
                    onPrefetchFull={prefetchProductFull}
                  />
                ))}
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
              {/* Ordenação — agora dentro do drawer (saiu do header para
                  liberar espaço na área principal). */}
              <div className="mb-5">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                  Ordenar por
                </h3>
                <div className="flex flex-wrap gap-2 px-1">
                  {SORT_KEYS.map((k) => {
                    const active = sort === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSort(k)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/60 text-foreground hover:bg-muted"
                        }`}
                      >
                        {active && <ArrowUpDown className="h-3.5 w-3.5" />}
                        {SORT_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                {[...categories].sort((a, b) => {
                  const aTirz = isTirzepatidaCategory(a) ? 0 : 1;
                  const bTirz = isTirzepatidaCategory(b) ? 0 : 1;
                  if (aTirz !== bTirz) return aTirz - bTirz;
                  return 0;
                }).map((c) => {
                  const checked = selectedCats.has(c.slug);
                  const count = countByCat.get(c.slug) ?? 0;
                  const isPromo = c.slug === "__promos__";
                  if (isPromo && count === 0) return null;
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex items-center gap-4 cursor-pointer min-h-[56px] px-4 rounded-2xl border transition-all ${
                          checked
                            ? "bg-primary/5 border-primary/40 shadow-sm"
                            : "bg-background border-border hover:bg-muted/60 hover:border-border"
                        } focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50`}
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

const Section = memo(function Section({
  title,
  items,
  onAdd,
  onPrefetch,
  onPrefetchFull,
}: {
  title: string;
  items: Product[];
  onAdd: (p: Product, finalPrice: number) => void;
  onPrefetch?: (slug: string) => void;
  onPrefetchFull?: (p: Product) => void;
}) {
  if (items.length === 0) return null;
  // Subtítulo automático para a seção de Promoções: comunica o maior
  // desconto disponível e reforça a hierarquia visual sem poluir.
  const isPromos = title.toLowerCase().includes("promo");
  const maxDiscount = isPromos
    ? items.reduce((acc, it) => {
        const pn = Number(it.price);
        const sn = it.sale_price != null ? Number(it.sale_price) : 0;
        const pct = sn > 0 && sn < pn ? Math.round((1 - sn / pn) * 100) : 0;
        return pct > acc ? pct : acc;
      }, 0)
    : 0;
  return (
      <div className="scroll-mt-36 md:scroll-mt-40">
      <div className="mb-3 md:mb-4 flex items-baseline gap-2 flex-wrap">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight leading-tight text-primary">
          {title}
        </h2>
        {isPromos && maxDiscount > 0 && (
          <span className="text-xs md:text-sm text-muted-foreground">
            até <span className="font-semibold text-secondary">{maxDiscount}% off</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {items.map((p, idx) => (
          <ProductCard
            key={p.id}
            p={p}
            index={idx}
            onAdd={onAdd}
            onPrefetch={onPrefetch}
            onPrefetchFull={onPrefetchFull}
          />
        ))}
      </div>
    </div>
  );
});

// Card individual — extraído para podermos plugar IntersectionObserver por item
// e disparar prefetch (dados + imagem hi-res) quando o card aparece na tela.
const ProductCard = memo(function ProductCard({
  p,
  index,
  onAdd,
  onPrefetch,
  onPrefetchFull,
}: {
  p: Product;
  index: number;
  onAdd: (p: Product, finalPrice: number) => void;
  onPrefetch?: (slug: string) => void;
  onPrefetchFull?: (p: Product) => void;
}) {
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  // Observa visibilidade UMA vez: ao primeiro intersect, dispara prefetch full
  // e desconecta. `rootMargin` antecipa enquanto o card ainda está fora da tela.
  useEffect(() => {
    if (!onPrefetchFull) return;
    const el = linkRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            // `requestIdleCallback` quando disponível — não compete com a renderização
            const run = () => onPrefetchFull(p);
            if ("requestIdleCallback" in window) {
              (window as unknown as { requestIdleCallback: (cb: () => void) => void })
                .requestIdleCallback(run);
            } else {
              timer = setTimeout(run, 200);
            }
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer != null) clearTimeout(timer);
    };
  }, [p, onPrefetchFull]);

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
  // Apenas um badge por card e nunca empilhado com "-x%". "Novo" vira um
  // ponto sutil + texto pequeno em cinza (não compete com o preço).
  // "Esgotado" continua forte porque indica indisponibilidade real.
  return (
            <Link
              ref={linkRef}
              to={`/produto/${p.slug}`}
              onMouseEnter={() => onPrefetch?.(p.slug)}
              onTouchStart={() => onPrefetch?.(p.slug)}
              className={`group relative flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-card)] transition-all ${isOut ? "opacity-70" : ""}`}
            >
              {/* Imagem — aspect quadrado + padding interno para uniformizar
                  produtos com recortes/proporções diferentes nos assets. */}
              <div className="relative aspect-square overflow-hidden bg-white p-3 sm:p-4">
                {(() => {
                  const r = responsiveImage(
                    p.image_url,
                    "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
                    {
                      // Quality 65 nas thumbs do catálogo: visualmente
                      // imperceptível em aspect-square pequeno, mas ~20-30% mais leve.
                      quality: 65,
                      // Widths enxutos (sem 1080/1280) — não fazem sentido em thumbs.
                      widths: [200, 300, 400, 560, 800],
                      fallbackWidth: 400,
                    }
                  );
                  // Os 4 primeiros cards são quase sempre o LCP no mobile
                  // (grid 2 colunas → 1ª linha = 2, 2ª linha = 4).
                  // Eager + fetchPriority high antecipa essas imagens críticas;
                  // o restante continua lazy para preservar dados.
                  const isAboveFold = index < 4;
                  return (
                    <img
                      src={r.src}
                      srcSet={r.srcSet || undefined}
                      sizes={r.sizes}
                      alt={p.name}
                      loading={isAboveFold ? "eager" : "lazy"}
                      decoding="async"
                      {...(isAboveFold ? { fetchPriority: "high" } as Record<string, string> : {})}
                      width={400}
                      height={400}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
                      className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  );
                })()}
                {isOut && (
                  <span className="absolute top-2 left-2 z-[1] inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-foreground/85 text-background">
                    Esgotado
                  </span>
                )}
                {hasRealSale && !isOut && (
                  <span className="badge-pill absolute top-2 left-2 z-[1] bg-secondary text-secondary-foreground font-bold shadow-sm">
                    -{discountPct}%
                  </span>
                )}
                {/* Wishlist: sempre visível, em pill branca no canto inferior direito da imagem */}
                <WishlistButton
                  productId={p.id}
                  size="sm"
                  className="absolute bottom-2 right-2 z-[1] bg-white/90 hover:bg-white shadow-sm rounded-full"
                />
              </div>

              {/* Conteúdo: slot de badge fixo + título + bloco de preço com
                  altura reservada — garante que CTA fica na MESMA linha entre
                  cards vizinhos do grid, mesmo sem promoção. */}
              <div className="flex flex-col flex-1 px-3 pt-2.5 pb-3 sm:px-3.5 sm:pt-3 sm:pb-4">
                {/* Slot fixo de "etiqueta superior" — reserva 16px sempre,
                    de modo que o título inicie na mesma altura em todos os cards. */}
                <div className="min-h-[16px] mb-1 flex items-center">
                  {isNew && !hasRealSale && !isOut && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Novo
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-[13px] sm:text-sm leading-snug text-foreground line-clamp-3 min-h-[3.9em]">
                  {p.name}
                </h3>
                {/* Bloco de preço com altura mínima reservada para a linha
                    "de R$" — alinha cards com e sem desconto na mesma altura. */}
                <div className="mt-2 leading-tight min-h-[64px] flex flex-col justify-end">
                  {hasRealSale ? (
                    <div className="text-xs text-muted-foreground line-through tabular-nums">
                      de {formatBRL(priceNum)}
                    </div>
                  ) : (
                    <div aria-hidden className="h-[16px]" />
                  )}
                  <div className="text-base md:text-lg font-extrabold text-primary tabular-nums">
                    {formatBRL(finalPrice)}
                  </div>
                  {/* Parcelamento — gatilho clássico de conversão.
                      Levemente mais legível que antes, ainda subordinado ao preço. */}
                  <div className="text-xs font-medium text-foreground/65 tabular-nums mt-0.5">
                    ou 3x de {formatBRL(finalPrice / 3)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOut) return;
                    onAdd(p, finalPrice);
                  }}
                  disabled={isOut}
                  aria-label={isOut ? "Esgotado" : `Adicionar ${p.name} ao carrinho`}
                  className="mt-3 inline-flex items-center justify-center gap-1 h-9 sm:h-10 w-full rounded-full bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-sm shadow-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Comprar
                </button>
              </div>
            </Link>
          );
});
