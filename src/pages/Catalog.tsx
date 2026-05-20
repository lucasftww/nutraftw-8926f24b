import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { imageUrl } from "@/lib/image";
import { prefetchImage, shouldPrefetch } from "@/lib/prefetch";
import { Search, SlidersHorizontal, X, ArrowUpDown, Check, Tag, Award, Filter } from "lucide-react";
import { SORT_KEYS, SORT_LABELS, type SortKey, getProductPricing, isTirzepatidaCategory, productScore } from "@/lib/catalog";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useProducts, useCategories, useBrands, type ProductRow } from "@/hooks/useProducts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ProductCard } from "@/components/product/ProductCard";
import { CategoryChips } from "@/components/product/CategoryChips";
import { HomeHero } from "@/components/home/HomeHero";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { FAQSection } from "@/components/home/FAQSection";

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
  // Respeita a configuração admin "Marcar produto como LANÇAMENTO até (N dias)".
  // Antes era hardcoded em 30 — agora vem de site_settings.badge_new_days.
  const settings = useSiteSettings();
  const badgeNewDays = Math.max(1, Number(settings.badge_new_days) || 30);
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
  const filterDrawerRef = useFocusTrap<HTMLElement>(filtersOpen, () => setFiltersOpen(false));
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
  // Bug fix: passa `maxStock` para o cart store rejeitar add além do estoque
  // disponível. Antes o cliente conseguia colocar 100 itens de produto com
  // stock=3 — o RPC create_order rejeitava, mas só na hora do checkout
  // (UX ruim — descoberta tardia).
  const handleAdd = useCallback((p: Product, price: number) => {
    add({ product_id: p.id, slug: p.slug, name: p.name, price, image_url: p.image_url }, 1, p.stock ?? undefined);
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

  // Pre-normaliza strings dos produtos UMA VEZ (na lista). Sem isso,
  // `normalizeString(p.name)` rodava 4× por produto a cada keystroke da busca.
  // Com 50 produtos isso = 200 normalizações/keystroke (5-20ms em dispositivos
  // antigos). Agora só recomputa quando a lista de produtos muda.
  const productsIndexed = useMemo(
    () =>
      products.map((p) => {
        const nameNorm = normalizeString(p.name);
        const descNorm = p.description ? normalizeString(p.description) : "";
        return {
          p,
          nameNorm,
          descNorm,
          // Sem espaços — segunda passada da busca tolerante ("tg" → "tg500mg").
          nameCompact: nameNorm.replace(/\s+/g, ""),
          descCompact: descNorm.replace(/\s+/g, ""),
        };
      }),
    [products]
  );

  const filtered = useMemo(
    () => {
      const qNorm = query ? normalizeString(query) : "";
      const qCompact = query ? compactString(query) : "";
      const wantsPromos = selectedCats.has("__promos__");
      const realCats = wantsPromos
        ? new Set([...selectedCats].filter((s) => s !== "__promos__"))
        : selectedCats;
      const hasCatFilter = selectedCats.size > 0;
      const hasBrandFilter = selectedBrands.size > 0;

      return productsIndexed
        .filter(({ p, nameNorm, descNorm, nameCompact, descCompact }) => {
          if (hasCatFilter) {
            // "__promos__" é pseudo-categoria — INTERSEÇÃO com categorias reais.
            if (wantsPromos && !getProductPricing(p).hasSale) return false;
            if (realCats.size > 0) {
              if (!p.category || !realCats.has(p.category.slug)) return false;
            } else if (!wantsPromos) {
              return false;
            }
          }
          if (hasBrandFilter) {
            if (!p.brand || !selectedBrands.has(p.brand.slug)) return false;
          }
          if (!qNorm) return true;
          if (nameNorm.includes(qNorm) || descNorm.includes(qNorm)) return true;
          return nameCompact.includes(qCompact) || descCompact.includes(qCompact);
        })
        .map((x) => x.p);
    },
    [productsIndexed, selectedCats, selectedBrands, query]
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
      {/* Barra de busca + filtros — STICKY (não fixed).
          Sticky resolve 2 bugs do `fixed top-14`:
          1) Em scroll=0 com AnnouncementBar visível, o header empurrado
             cobria parcialmente a busca (z-40 > z-30). Sticky respeita
             flow do documento → nunca há sobreposição.
          2) Pulinho visual ao rolar: com fixed, a busca não acompanhava
             o "encolher" do header quando a AnnouncementBar saía.
          A barra é o primeiro elemento no fluxo do Catalog (antes da
          grade), então quando o usuário rola, ela gruda exatamente abaixo
          do Header sticky (top-14 = 56px = altura do header mobile). */}
      <div
        className="sticky top-14 md:top-16 z-30 border-b border-border/60 bg-background shadow-sm"
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
              {/* h-11 mobile (44px) — WCAG 2.5.5 tap target.
                  Antes era h-10 (40px), 4px abaixo do mínimo. */}
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                aria-label="Buscar produtos"
                className="h-11 w-full rounded-full border border-input bg-muted/30 pl-10 pr-11 text-base sm:text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/30 focus:bg-background focus:ring-4 focus:ring-primary/5"
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
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Botão filtros — h-11 w-11 (44x44) em todas telas para WCAG.
                Badge agora mostra o NÚMERO de filtros ativos (antes era só
                um pontinho), comunicando "estado" do filtro à primeira vista. */}
            {(() => {
              const activeFilterCount =
                selectedCats.size +
                selectedBrands.size +
                (sort !== "categoria" ? 1 : 0);
              return (
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  aria-label={
                    activeFilterCount > 0
                      ? `Abrir filtros (${activeFilterCount} ativo${activeFilterCount === 1 ? "" : "s"})`
                      : "Abrir filtros"
                  }
                  aria-haspopup="dialog"
                  className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-input bg-background shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none ring-2 ring-background tabular-nums"
                      aria-hidden
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              );
            })()}
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

      {/* Hero da home — só renderiza quando NÃO há filtros nem busca ativa.
          Cliente que veio direto de /produto/X com `?categoria=X` ou
          digitando algo na busca já tem contexto — o hero atrapalharia. */}
      {!loading && !query && selectedCats.size === 0 && selectedBrands.size === 0 && (
        <HomeHero />
      )}

      {/* Chips de categoria — atalho 1-tap entre busca e grade.
          UX padrão BR (ML/Magalu/Shopee). Click filtra direto, sem
          abrir o drawer. Reaproveita state de selectedCats/toggleCat. */}
      {!loading && displayedCategories.length > 0 && (
        <div className="container mx-auto px-4 pt-3 md:pt-4">
          <CategoryChips
            categories={displayedCategories.filter((c) => c.slug !== "__promos__")}
            selectedSlugs={selectedCats}
            onToggle={toggleCat}
            onClear={() => {
              setSelectedCats(new Set());
              setSearchParams((curr) => {
                const params = new URLSearchParams(curr);
                params.delete("categoria");
                return params;
              }, { replace: true });
            }}
            counts={countByCat}
          />
        </div>
      )}

      {/* Sections — sem pt compensatório: a busca agora é sticky e ocupa
          espaço no fluxo natural, então NÃO precisamos mais reservar 56px
          como antes. scroll-mt-32 mantém âncoras visíveis abaixo do header.
          pt-4 md:pt-6 dá respiro entre a busca e a primeira seção
          (antes pt-3 ficava colado em mobile). */}
      <section className="relative pt-4 md:pt-6 pb-2 scroll-mt-32">
        <div className="container mx-auto px-4">
          {/* overflow-anchor:none impede o navegador de "puxar" o scroll
              quando novos cards são inseridos pelo infinite scroll —
              evita a sensação de a página subir sozinha no mobile. */}
          <div className="space-y-6 md:space-y-10 pb-16 [overflow-anchor:none]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
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
              // Empty state redesenhado: ícone maior em pill colorida + tipografia mais
              // hierárquica + py adaptativo (py-20 fixo era muito espaço em mobile).
              <div className="text-center py-12 md:py-20">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <p className="text-foreground font-bold text-base">Nenhum produto encontrado</p>
                <p className="text-muted-foreground text-[13px] md:text-sm mt-1.5 max-w-xs mx-auto">
                  Tente remover filtros ou ajustar a busca acima.
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
                    // h-11 (44px WCAG) — antes era h-10.
                    className="mt-5 inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow active:scale-[0.99] transition-all shadow-sm"
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
                    badgeNewDays={badgeNewDays}
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
                    badgeNewDays={badgeNewDays}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* FAQ + Depoimentos — renderiza só na "home" (sem filtros/busca).
          Ordem mental: produtos → FAQ (responde objeções) → social proof
          → comprar. Se cliente já está filtrando, ele tem intenção clara
          e não precisa do FAQ/testimonials no caminho.

          TestimonialsSection recebe array via prop — vazio = não renderiza.
          Quando tiver feedbacks REAIS, troque por:
            <TestimonialsSection items={[
              { name: "Real Name", city: "São Paulo, SP",
                text: "Feedback real coletado via WhatsApp/email",
                rating: 5 },
              ...
            ]} />
          Falsificar depoimentos = CDC art. 37 (publicidade enganosa). */}
      {!loading && !query && selectedCats.size === 0 && selectedBrands.size === 0 && (
        <>
          <FAQSection />
          <TestimonialsSection items={[]} />
        </>
      )}

      {/* ============================================================
          FILTERS DRAWER — redesenho clean & profissional
          ============================================================
          Hierarquia visual nova:
          1. Header com ícone, contador de ativos, fechar
          2. Chips de filtros ATIVOS (removíveis) — só aparece se houver
          3. Seções com header rico (ícone + título uppercase + contador local)
          4. CTA contextual "Ver N produtos" (substitui o "Aplicar" que
             era enganoso — atualização já é live)
          5. Link "Limpar tudo" subtle como secundário
       */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filtros do catálogo">
          <div
            className="absolute inset-0 bg-foreground/55 backdrop-blur-[3px] animate-in fade-in duration-200"
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            ref={filterDrawerRef}
            tabIndex={-1}
            className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-background flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl outline-none"
          >
            {(() => {
              const activeFilterCount =
                selectedCats.size +
                selectedBrands.size +
                (sort !== "categoria" ? 1 : 0);

              // Limpar TODOS os filtros (não toca em ?q porque busca é fora do drawer)
              const clearAll = () => {
                setSelectedCats(new Set());
                setSelectedBrands(new Set());
                setSearchParams((curr) => {
                  const params = new URLSearchParams(curr);
                  params.delete("marca");
                  params.delete("categoria");
                  params.delete("ordenar");
                  return params;
                }, { replace: true });
              };

              return (
                <>
                  {/* ===== HEADER ===== */}
                  <header className="flex items-center justify-between gap-3 px-5 sm:px-6 h-16 border-b border-border/60 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Filter className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold tracking-tight text-foreground leading-none">
                          Filtros
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-none">
                          {activeFilterCount === 0
                            ? "Refine seu catálogo"
                            : `${activeFilterCount} filtro${activeFilterCount === 1 ? "" : "s"} ativo${activeFilterCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFiltersOpen(false)}
                      className="h-11 w-11 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                      aria-label="Fechar filtros"
                    >
                      <X className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </header>

                  {/* ===== BODY (scrollable) ===== */}
                  <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
                    {/* ----- Chips de filtros ATIVOS (só aparece se houver) ----- */}
                    {activeFilterCount > 0 && (
                      <section className="px-5 sm:px-6 py-4 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Filtros ativos
                          </p>
                          <button
                            type="button"
                            onClick={clearAll}
                            className="text-[11px] font-semibold text-secondary-text hover:underline underline-offset-2 transition-colors"
                          >
                            Limpar tudo
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sort !== "categoria" && (
                            <ActiveChip
                              label={SORT_LABELS[sort]}
                              onRemove={() => setSort("categoria")}
                            />
                          )}
                          {[...selectedCats].map((slug) => {
                            const cat = displayedCategories.find((c) => c.slug === slug);
                            if (!cat) return null;
                            return (
                              <ActiveChip
                                key={`cat-${slug}`}
                                label={cat.name}
                                onRemove={() => toggleCat(slug)}
                              />
                            );
                          })}
                          {[...selectedBrands].map((slug) => {
                            const brand = brands.find((b) => b.slug === slug);
                            if (!brand) return null;
                            return (
                              <ActiveChip
                                key={`brand-${slug}`}
                                label={brand.name}
                                onRemove={() => toggleBrand(slug)}
                              />
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* ----- Seção: ORDENAR ----- */}
                    <FilterSection icon={ArrowUpDown} title="Ordenar por">
                      <ul className="divide-y divide-border/40 -mx-2 sm:-mx-3">
                        {SORT_KEYS.map((k) => {
                          const active = sort === k;
                          return (
                            <li key={k}>
                              <button
                                type="button"
                                onClick={() => setSort(k)}
                                aria-pressed={active}
                                className="w-full flex items-center justify-between gap-3 px-3 min-h-[44px] py-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                              >
                                <span className={`text-[14px] ${active ? "text-foreground font-semibold" : "text-foreground/80"}`}>
                                  {SORT_LABELS[k]}
                                </span>
                                {/* Radio visual: bolinha preenchida quando ativo */}
                                <span
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all shrink-0 ${
                                    active
                                      ? "border-primary bg-primary"
                                      : "border-border bg-background"
                                  }`}
                                  aria-hidden
                                >
                                  {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </FilterSection>

                    {/* ----- Seção: CATEGORIAS ----- */}
                    <FilterSection
                      icon={Tag}
                      title="Categorias"
                      action={
                        selectedCats.size > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCats(new Set());
                              setSearchParams((curr) => {
                                const params = new URLSearchParams(curr);
                                params.delete("categoria");
                                return params;
                              }, { replace: true });
                            }}
                            className="text-[11px] font-semibold text-secondary-text hover:underline underline-offset-2"
                          >
                            Limpar ({selectedCats.size})
                          </button>
                        ) : null
                      }
                    >
                      <ul className="divide-y divide-border/40 -mx-2 sm:-mx-3">
                        {[...displayedCategories]
                          .sort((a, b) => {
                            const aTirz = isTirzepatidaCategory(a) ? 0 : 1;
                            const bTirz = isTirzepatidaCategory(b) ? 0 : 1;
                            if (aTirz !== bTirz) return aTirz - bTirz;
                            return 0;
                          })
                          .map((c) => {
                            const checked = selectedCats.has(c.slug);
                            const count = countByCat.get(c.slug) ?? 0;
                            const isPromo = c.slug === "__promos__";
                            if (isPromo && count === 0) return null;
                            return (
                              <li key={c.id}>
                                <label className="group flex items-center gap-3 cursor-pointer min-h-[44px] px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCat(c.slug)}
                                    className="sr-only"
                                  />
                                  {/* Checkbox grande (20x20) com check animado */}
                                  <span
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0 transition-all ${
                                      checked
                                        ? "bg-primary border-primary"
                                        : "border-border bg-background group-hover:border-primary/40"
                                    }`}
                                    aria-hidden
                                  >
                                    {checked && (
                                      <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />
                                    )}
                                  </span>
                                  <span className={`flex-1 text-[14px] ${checked ? "text-foreground font-semibold" : "text-foreground/85"}`}>
                                    {c.name}
                                  </span>
                                  <span
                                    className={`text-[11px] tabular-nums shrink-0 ${
                                      checked ? "text-foreground/70 font-semibold" : "text-muted-foreground/70"
                                    }`}
                                  >
                                    {count}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                      </ul>
                    </FilterSection>

                    {/* ----- Seção: MARCAS ----- */}
                    {brands.length > 0 && (
                      <FilterSection
                        icon={Award}
                        title="Marcas"
                        action={
                          selectedBrands.size > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBrands(new Set());
                                setSearchParams((curr) => {
                                  const params = new URLSearchParams(curr);
                                  params.delete("marca");
                                  return params;
                                }, { replace: true });
                              }}
                              className="text-[11px] font-semibold text-secondary-text hover:underline underline-offset-2"
                            >
                              Limpar ({selectedBrands.size})
                            </button>
                          ) : null
                        }
                      >
                        <div className="flex flex-wrap gap-2">
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
                                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium transition-all ${
                                  checked
                                    ? "bg-primary text-primary-foreground border-2 border-primary shadow-sm"
                                    : dim
                                      ? "bg-transparent text-muted-foreground/40 border-2 border-border/40 cursor-not-allowed"
                                      : "bg-background text-foreground/80 border-2 border-border hover:border-primary/40 hover:text-foreground"
                                }`}
                              >
                                {b.name}
                                {count > 0 && (
                                  <span
                                    className={`text-[11px] tabular-nums font-semibold ${
                                      checked ? "text-primary-foreground/80" : "text-muted-foreground/70"
                                    }`}
                                  >
                                    · {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </FilterSection>
                    )}

                    {/* Padding inferior para garantir respiro antes do footer */}
                    <div className="h-4" />
                  </div>

                  {/* ===== FOOTER (CTA contextual) =====
                      Antes era "Aplicar filtros" que enganava (tudo já é
                      live-update). Agora mostra a CONTAGEM real e fecha. */}
                  <footer
                    className="border-t border-border/60 bg-background px-5 sm:px-6 py-4 shrink-0"
                    style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
                  >
                    <button
                      onClick={() => setFiltersOpen(false)}
                      className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold tracking-tight hover:bg-primary-glow active:scale-[0.99] transition-all shadow-elegant"
                    >
                      Ver {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
                    </button>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="mt-3 w-full text-center text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Limpar todos os filtros
                      </button>
                    )}
                  </footer>
                </>
              );
            })()}
          </aside>
        </div>
      )}
    </>
  );
}

/* ============================================================
   Helpers do drawer de filtros — locais por simplicidade.
   ============================================================ */

/** Chip removível de filtro ativo. Mostrado no topo do drawer quando
 *  há filtros aplicados — permite remover sem rolar até a seção. */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold tracking-tight">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary-foreground/15 transition-colors -mr-0.5"
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

/** Seção do drawer — header rico (ícone + título uppercase + action
 *  opcional à direita) + container do conteúdo com padding consistente.
 *  Accent line gradient brand (navy→cyan) reforça identidade visual. */
function FilterSection({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Tag;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 sm:px-6 py-5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/70">
          <span className="inline-block h-3 w-0.5 rounded-full bg-gradient-brand" aria-hidden />
          <Icon className="h-3.5 w-3.5 text-primary/70" strokeWidth={2.25} />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const Section = memo(function Section({
  title,
  items,
  onAdd,
  onPrefetch,
  onPrefetchFull,
  badgeNewDays = 30,
}: {
  title: string;
  items: Product[];
  onAdd: (p: Product, finalPrice: number) => void;
  onPrefetch?: (slug: string) => void;
  onPrefetchFull?: (p: Product) => void;
  badgeNewDays?: number;
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
      {/* Header da seção com accent line gradient da marca (navy → cyan). */}
      <div className="mb-3 md:mb-4 flex items-center gap-2.5 flex-wrap">
        <span className="inline-block h-5 md:h-6 w-1 rounded-full bg-gradient-brand shrink-0" aria-hidden />
        <h2 className="text-lg md:text-2xl font-bold tracking-tight leading-tight text-primary">
          {title}
        </h2>
        {isPromos && maxDiscount > 0 && (
          <span className="text-xs md:text-sm text-muted-foreground">
            até <span className="font-extrabold text-success">{maxDiscount}% off</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
        {items.map((p, idx) => (
          <ProductCard
            key={p.id}
            p={p}
            index={idx}
            onAdd={onAdd}
            onPrefetch={onPrefetch}
            onPrefetchFull={onPrefetchFull}
            badgeNewDays={badgeNewDays}
          />
        ))}
      </div>
    </div>
  );
});

// Card individual — extraído para podermos plugar IntersectionObserver por item
// e disparar prefetch (dados + imagem hi-res) quando o card aparece na tela.
// ProductCard agora vive em src/components/product/ProductCard.tsx
// — pode ser reusado em Wishlist/Related/Recommendations sem duplicar.
