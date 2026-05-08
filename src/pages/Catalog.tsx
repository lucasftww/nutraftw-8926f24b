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
import { SORT_KEYS, SORT_LABELS, type SortKey, getProductPricing, isTirzepatidaCategory, productScore } from "@/lib/catalog";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useProducts, useCategories, useBrands, type ProductRow } from "@/hooks/useProducts";

type Product = ProductRow;

// Normaliza para busca tolerante: remove acentos, pontuação (`.`, `-`, `/`, `_`)
// e colapsa espaços. Assim "tg" encontra "T.G.", "amox 500" encontra
// "Amoxicilina-500", "vit b12" encontra "Vitamina B12", etc.
const normalizeString = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\p{L}\p{N}]+/gu, " ") // pontuação/símbolos viram espaço
    .trim()
    .replace(/\s+/g, " ");

// Versão "compacta" (sem espaços) — usada como segunda chance, para
// que "tg" case com "t g" (que veio de "T.G.").
const compactString = (s: string) => normalizeString(s).replace(/\s+/g, "");

export default function Catalog() {
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlCategoria = searchParams.get("categoria") ?? "";
  const urlMarca = searchParams.get("marca") ?? "";
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
    // Suporta múltiplas categorias separadas por vírgula na URL para consistência com marcas.
    setSelectedCats(urlCategoria ? new Set(urlCategoria.split(",").filter(Boolean)) : new Set());
  }, [urlCategoria]);
  useEffect(() => {
    setSelectedBrands(urlMarca ? new Set(urlMarca.split(",").filter(Boolean)) : new Set());
  }, [urlMarca]);
  useEffect(() => {
    if (query === urlQuery) return;
    const t = setTimeout(() => {
      // Lê searchParams via setter funcional para evitar sobrescrever
      // alterações concorrentes (ex.: ?categoria=…) feitas no debounce.
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (query) params.set("q", query);
        else params.delete("q");
        return params;
      }, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [query, urlQuery, setSearchParams]);

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

  // Prefetch combinado: imagem hero hi-res (mesma variante usada em
  // ProductDetail). Disparado quando o card entra na viewport.
  //
  // IMPORTANTE: NÃO fazemos prefetch da query do produto na viewport — isso
  // gerava uma chamada Supabase por card visível (até ~50 requests redundantes
  // no load inicial, já que `useProducts` retorna a lista completa). O
  // prefetch da query continua acontecendo via hover/touch no card (sinal de
  // intenção real), tratado em `prefetchProduct` via onMouseEnter/onTouchStart.
  //
  // Dedup por slug durante a sessão da página: ao digitar na busca, a lista
  // filtrada é recriada e cada `ProductCard` monta um novo IntersectionObserver
  // — sem este Set, todo card já visível dispararia prefetch de imagem de novo.
  const fullPrefetchedRef = useRef<Set<string>>(new Set());
  const prefetchProductFull = useCallback(
    (p: Product) => {
      if (!shouldPrefetch()) return;
      if (fullPrefetchedRef.current.has(p.slug)) return;
      fullPrefetchedRef.current.add(p.slug);
      // Casa com responsiveImage(..., { fallbackWidth: 800, quality: 80 }) na ProductDetail
      prefetchImage(imageUrl(p.image_url, { width: 800, quality: 80 }));
    },
    []
  );

  // Handler estável para "Adicionar ao carrinho" no card → evita re-render dos cards.
  const handleAdd = useCallback((p: Product, price: number) => {
    add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url });
    openCart();
  }, [add, openCart]);

   useSEO({
     title: "Catálogo de farmacêuticos importados",
     description:
       "Catálogo com produtos farmacêuticos importados: peptídeos, suporte e mais, com preços transparentes e envio para todo o Brasil.",
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

      // Sincroniza URL para permitir compartilhar/voltar.
      setSearchParams((curr) => {
        const params = new URLSearchParams(curr);
        if (next.size === 0) params.delete("categoria");
        else params.set("categoria", [...next].join(","));
        return params;
      }, { replace: true });

      return next;
    });
  };

  const toggleBrand = (slug: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      // Sincroniza URL para permitir compartilhar/voltar.
      setSearchParams((curr) => {
        const params = new URLSearchParams(curr);
        if (next.size === 0) params.delete("marca");
        else params.set("marca", [...next].join(","));
        return params;
      }, { replace: true });
      return next;
    });
  };

  const filtered = useMemo(
    () => {
      const qNorm = query ? normalizeString(query) : "";
      const qCompact = query ? compactString(query) : "";

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
          if (wantsPromos && !getProductPricing(p).hasSale) return false;
          if (realCats.size > 0) {
            if (!p.category || !realCats.has(p.category.slug)) return false;
          } else if (!wantsPromos) {
            return false;
          }
        }
        if (selectedBrands.size > 0) {
          if (!p.brand || !selectedBrands.has(p.brand.slug)) return false;
        }
        if (!qNorm) return true;
        const nameNorm = normalizeString(p.name);
        const descNorm = p.description ? normalizeString(p.description) : "";
        if (nameNorm.includes(qNorm) || descNorm.includes(qNorm)) return true;
        // Segunda passada sem espaços: "tg" → casa em "tg" dentro de
        // compact("T.G. 500mg") = "tg500mg".
        const nameCompact = nameNorm.replace(/\s+/g, "");
        const descCompact = descNorm.replace(/\s+/g, "");
        return nameCompact.includes(qCompact) || descCompact.includes(qCompact);
      });
    },
    [products, selectedCats, selectedBrands, query]
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
    if (sort === "preco_asc" || sort === "preco_desc") {
      const dir = sort === "preco_asc" ? 1 : -1;
      return (a: Product, b: Product) => 
        (getProductPricing(a).finalPrice - getProductPricing(b).finalPrice) * dir;
    }
    // "categoria" (curadoria): mais desconto primeiro, desempate por score
    return (a: Product, b: Product) => {
      const dDiff = getProductPricing(b).discountPct - getProductPricing(a).discountPct;
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
      : filtered.filter((p) => getProductPricing(p).hasSale).sort(sortComparator);
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
    const promoCount = products.reduce((acc, p) => acc + (getProductPricing(p).hasSale ? 1 : 0), 0);
    map.set("__promos__", promoCount);
    return map;
  }, [products]);

  // Contagem de produtos por marca (para o filtro). Considera as categorias já
  // selecionadas para que o número reflita o que será exibido após aplicar.
  const countByBrand = useMemo(() => {
    const map = new Map<string, number>();
    const wantsPromos = selectedCats.has("__promos__");
    const realCats = new Set([...selectedCats].filter((s) => s !== "__promos__"));
    for (const p of products) {
      if (selectedCats.size > 0) {
        if (wantsPromos && !getProductPricing(p).hasSale) continue;
        if (realCats.size > 0 && (!p.category || !realCats.has(p.category.slug))) continue;
      }
      const k = p.brand?.slug;
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [products, selectedCats]);

  const displayedCategories = useMemo(() => {
    const promosCount = countByCat.get("__promos__") ?? 0;
    const base = [...categories];
    if (promosCount > 0 && !base.some((c) => c.slug === "__promos__")) {
      base.unshift({
        id: "__promos__",
        slug: "__promos__",
        name: "Promoções",
      } as (typeof categories)[number]);
    }
    return base;
  }, [categories, countByCat]);

  return (
    <>
      {/* Barra fixa de busca + filtros — redesenhada do zero.
          - `fixed` logo abaixo do header (top-16 / top-20).
          - Fundo opaco + sombra discreta para separar do conteúdo
            durante a rolagem (não "vaza" através).
          - Layout único: título (md+) | busca | botão filtros.
          - Linha auxiliar mostra termo buscado e contagem viva. */}
      <div
        className="fixed inset-x-0 top-12 md:top-14 z-30 border-b border-border/60 bg-background shadow-sm"
        role="search"
      >
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-5 lg:px-8 py-2 md:py-3">
          <div className="flex items-center gap-2 md:gap-4">
            <h1 className="hidden md:block shrink-0 text-2xl font-extrabold tracking-tight text-foreground leading-none">
              Catálogo
            </h1>

            <div className="relative flex-1 min-w-0">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                aria-label="Buscar produtos"
                className="h-10 md:h-11 w-full rounded-full border border-input bg-muted/30 pl-10 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/30 focus:bg-background focus:ring-4 focus:ring-primary/5"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    // Limpa URL imediatamente ao clicar no X, sem esperar o debounce.
                    setSearchParams((prev) => {
                      const params = new URLSearchParams(prev);
                      params.delete("q");
                      return params;
                    }, { replace: true });
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="Abrir filtros"
              aria-haspopup="dialog"
              className="relative inline-flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-full border border-input bg-background shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(selectedCats.size > 0 || selectedBrands.size > 0 || sort !== "categoria") && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </button>
          </div>

          {query && (
            <p className="mt-1.5 truncate text-[11px] md:text-xs font-medium text-muted-foreground">
              Buscando por: <span className="text-primary">"{query}"</span>
              {!loading && (
                <span className="text-muted-foreground/70">
                  {" "}— {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Sections — pt compensa altura da barra fixa (busca + filtros) */}
      <section className="relative pt-[56px] md:pt-[64px] pb-2 scroll-mt-32">
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
                {(selectedCats.size > 0 || selectedBrands.size > 0 || query) && (
                  <button
                    onClick={() => {
                      setSelectedCats(new Set());
                      setSelectedBrands(new Set());
                      setQuery("");
                      setSearchParams((curr) => {
                        const params = new URLSearchParams(curr);
                        params.delete("marca");
                        params.delete("categoria");
                        params.delete("q");
                        return params;
                      }, { replace: true });
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
          <aside style={{ fontFamily: "'Poppins', system-ui, sans-serif" }} className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white flex flex-col animate-in slide-in-from-right duration-200 border-l border-border/60">
            {/* Header minimalista */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5 border-b border-border/60">
              <div>
                <h2 className="text-[22px] font-semibold text-foreground tracking-tight leading-none mb-1.5">
                  Filtros
                </h2>
                <p className="text-[13px] text-muted-foreground/80 leading-snug">
                  Refine sua busca usando os filtros abaixo
                </p>
              </div>
              <button
                onClick={() => setFiltersOpen(false)}
                className="h-9 w-9 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg border border-border/70 hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors bg-white"
                aria-label="Fechar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6 scrollbar-thin space-y-7">
              {/* Ordenar */}
              <section>
                <h3 className="text-[13px] font-semibold text-foreground mb-2.5">Ordenar</h3>
                <div className="flex flex-wrap gap-1.5">
                  {SORT_KEYS.map((k) => {
                    const active = sort === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSort(k)}
                        aria-pressed={active}
                        className={`inline-flex items-center h-8 px-3 rounded-md text-[12.5px] transition-colors ${
                          active
                            ? "bg-foreground text-background"
                            : "bg-white text-muted-foreground border border-border/70 hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {SORT_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Categorias */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[13px] font-semibold text-foreground">Categoria</h3>
                  {selectedCats.size > 0 && (
                    <button
                      onClick={() => setSelectedCats(new Set())}
                      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <ul className="flex flex-col border-y border-border/50 divide-y divide-border/40">
                  {[...displayedCategories].sort((a, b) => {
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
                          className="group flex items-center gap-3 cursor-pointer h-11 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCat(c.slug)}
                            className="sr-only"
                          />
                          <div
                            className={`h-[16px] w-[16px] rounded border flex items-center justify-center shrink-0 transition-colors ml-1 ${
                              checked ? "bg-foreground border-foreground" : "border-border bg-white group-hover:border-foreground/50"
                            }`}
                            aria-hidden="true"
                          >
                            {checked && (
                              <svg className="h-2.5 w-2.5 text-background" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`flex-1 text-[13.5px] ${checked ? "text-foreground font-medium" : "text-foreground/80"}`}>
                            {c.name}
                          </span>
                          <span className="text-[11.5px] tabular-nums text-muted-foreground/60 mr-1">
                            {count}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Marcas */}
              {brands.length > 0 && (
                <section className="pb-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[13px] font-semibold text-foreground">Marca</h3>
                    {selectedBrands.size > 0 && (
                      <button
                        onClick={() => {
                          setSelectedBrands(new Set());
                          setSearchParams((curr) => {
                            const params = new URLSearchParams(curr);
                            params.delete("marca");
                            return params;
                          }, { replace: true });
                        }}
                        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {brands.map((b) => {
                      const checked = selectedBrands.has(b.slug);
                      const count = countByBrand.get(b.slug) ?? 0;
                      const dim = count === 0 && !checked;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBrand(b.slug)}
                          aria-pressed={checked}
                          disabled={dim}
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] transition-colors ${
                            checked
                              ? "bg-foreground text-background"
                              : dim
                                ? "bg-transparent text-muted-foreground/40 border border-border/40 cursor-not-allowed"
                                : "bg-white text-muted-foreground border border-border/70 hover:border-foreground/40 hover:text-foreground"
                          }`}
                        >
                          {b.name}
                          {count > 0 && (
                            <span className={`text-[10.5px] tabular-nums ${checked ? "text-background/70" : "text-muted-foreground/60"}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            <div
              className="px-7 py-4 border-t border-border/60 bg-white"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
            >
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setSelectedCats(new Set());
                    setSelectedBrands(new Set());
                    setQuery("");
                    setSearchParams((curr) => {
                      const params = new URLSearchParams(curr);
                      params.delete("marca");
                      params.delete("categoria");
                      params.delete("q");
                      return params;
                    }, { replace: true });
                  }}
                  className="h-10 px-5 rounded-md text-[13px] font-medium text-foreground bg-white border border-border/70 hover:border-foreground/40 transition-colors"
                >
                  Limpar Filtros
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="h-10 px-5 rounded-md bg-foreground text-background text-[13px] font-semibold tracking-tight hover:bg-foreground/90 active:scale-[0.99] transition-all"
                >
                  Aplicar Filtros
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
            até <span className="font-extrabold text-success">{maxDiscount}% off</span>
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
    // Depender de p.slug (não do objeto p) evita reconectar o IntersectionObserver
    // a cada re-render da lista filtrada (quando o usuário digita na busca).
    // A função `onPrefetchFull` é estável (useCallback no Catalog).
  }, [p.slug, onPrefetchFull]);

  const { hasSale, discountPct, finalPrice } = getProductPricing(p);
  const isOut = (p.stock ?? 0) <= 0;
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
  const isNew = !isOut && ageDays <= 30;
  const isLaunch = !!p.is_new_release;
  const isOffer = !!p.is_on_offer;
  // Apenas um badge por card e nunca empilhado com "-x%". "Novo" vira um
  // ponto sutil + texto pequeno em cinza (não compete com o preço).
  // "Esgotado" continua forte porque indica indisponibilidade real.
  // Prioridade: Esgotado (vermelho) > Lançamento (azul) > Oferta (vermelho) > -X% OFF (laranja).
  return (
            <Link
              ref={linkRef}
              to={`/produto/${p.slug}`}
              onMouseEnter={() => onPrefetch?.(p.slug)}
              onTouchStart={() => onPrefetch?.(p.slug)}
              className={`group relative flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 ${isOut ? "opacity-70" : ""}`}
            >
              {/* Imagem — aspect quadrado + padding interno para uniformizar
                  produtos com recortes/proporções diferentes nos assets. */}
              <div className="relative aspect-square overflow-hidden bg-white p-5 sm:p-6 flex items-center justify-center group-hover:bg-muted/5 transition-colors">
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
                      {...(isAboveFold ? { fetchpriority: "high" } as Record<string, string> : {})}
                      width={400}
                      height={400}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
                      className="max-w-[85%] max-h-[85%] w-auto h-auto object-contain mx-auto transition-transform duration-500 group-hover:scale-105"
                    />
                  );
                })()}
                {(() => {
                  // Apenas UMA etiqueta visível por vez no canto superior esquerdo.
                  const pillBase =
                    "absolute top-2.5 left-2.5 z-[1] inline-flex items-center rounded-full text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 leading-none shadow-sm backdrop-blur-sm";
                  if (isOut) {
                    return (
                      <span className={`${pillBase} bg-destructive text-destructive-foreground`}>
                        ESGOTADO
                      </span>
                    );
                  }
                  if (isLaunch) {
                    return (
                      <span className={`${pillBase} bg-primary text-primary-foreground`}>
                        LANÇAMENTO
                      </span>
                    );
                  }
                  if (hasSale) {
                    return (
                      <span className={`${pillBase} bg-secondary text-secondary-foreground`}>
                        -{discountPct}% OFF
                      </span>
                    );
                  }
                  if (isOffer) {
                    return (
                      <span className={`${pillBase} bg-destructive text-destructive-foreground`}>
                        OFERTA
                      </span>
                    );
                  }
                  return null;
                })()}
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
              <div className="flex flex-col flex-1 px-3 pt-2 pb-3 sm:px-3.5 sm:pt-3 sm:pb-4">
                {/* Slot fixo de "etiqueta superior" — reserva 16px sempre,
                    de modo que o título inicie na mesma altura em todos os cards. */}
                <h3 className="font-semibold text-[13px] sm:text-[14px] leading-snug text-foreground line-clamp-2 min-h-[2.8em]">
                  {p.name}
                </h3>
                {/* Bloco de preço com altura mínima reservada para a linha
                    "de R$" — alinha cards com e sem desconto na mesma altura. */}
                <div className="mt-auto pt-2 leading-tight min-h-[60px] flex flex-col justify-end">
                  {hasSale ? (
                    <div className="text-[10px] sm:text-[11px] text-oldPrice font-medium line-through tabular-nums opacity-70">
                      de {formatBRL(getProductPricing(p).basePrice)}
                    </div>
                  ) : (
                    <div aria-hidden className="h-[12px] sm:h-[14px]" />
                  )}
                  <div className="text-[16px] sm:text-[19px] font-extrabold text-primary tabular-nums tracking-tight">
                    {formatBRL(finalPrice)}
                  </div>
                  {/* Parcelamento — gatilho clássico de conversão.
                      Levemente mais legível que antes, ainda subordinado ao preço. */}
                  <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground tabular-nums mt-0.5">
                    ou 3x de {formatBRL(finalPrice / 3)}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    // Deixa o Link do card cuidar da navegação — apenas
                    // garantimos foco/clique explícito acessível para o nicho
                    // 40+ que pode não perceber que o card inteiro é clicável.
                  }}
                  className="inline-flex items-center justify-center h-9 w-full rounded-full border border-primary/15 bg-background text-primary text-[12.5px] font-semibold hover:bg-primary/5 hover:border-primary/30 active:scale-[0.98] transition-all"
                >
                  Ver produto
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOut) return;
                    onAdd(p, finalPrice);
                  }}
                  disabled={isOut}
                  className="btn-cta h-10 w-full !text-[13.5px] !gap-1.5 !px-0"
                >
                  <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Comprar
                </button>
                </div>
              </div>
            </Link>
          );
});
