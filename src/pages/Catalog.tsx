import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { responsiveImage, imageUrl } from "@/lib/image";
import { prefetchImage, shouldPrefetch } from "@/lib/prefetch";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { Search, SlidersHorizontal, ShoppingCart, X, ArrowUpDown } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useProducts, useCategories, type ProductRow } from "@/hooks/useProducts";

type Product = ProductRow;

const SORT_KEYS = ["categoria", "recentes", "az"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const PROMO_PREVIEW_LIMIT = 4;
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

  // Infinite scroll — carrega incrementalmente para reduzir tempo inicial de render.
  // PAGE_SIZE controla a "primeira dose" de produtos visíveis e o incremento de cada
  // "Carregar mais". Foi ampliado para 24 para evitar a sensação de "só 4 por categoria"
  // — com muitas categorias o round-robin antigo distribuía 1-2 itens em cada e dava
  // a impressão de catálogo vazio.
  const PAGE_SIZE = 24;
  // Mínimo garantido por categoria no PRIMEIRO batch antes do round-robin distribuir
  // o excedente. Mantém cada categoria com bloco visualmente completo (linha 4×2 do
  // grid mobile, ou 4×2 do desktop).
  const MIN_PER_CATEGORY = 8;
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

  // Reseta a paginação sempre que os critérios de listagem mudarem
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, selectedCats, sort]);

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

  // Paginação uniforme: PAGE_SIZE itens por batch, fluindo na ordem
  // Promoções → Categoria 1 → Categoria 2 → … Mesma regra em mobile e desktop.
  const paginated = useMemo(() => {
    let remaining = visibleCount;
    const promoLimit = grouped.showOnlyPromos
      ? remaining
      : Math.min(PROMO_PREVIEW_LIMIT, remaining, grouped.promos.length);
    const promos = grouped.promos.slice(0, promoLimit);
    remaining -= promos.length;

    // Round-robin: garante que TODAS as categorias apareçam (pelo menos 1
    // item) antes de uma só monopolizar a paginação. Antes, Tirzepatida com
    // 8+ produtos consumia tudo e categorias menores nunca apareciam até o
    // usuário clicar "Carregar mais" várias vezes.
    // Distribuição em DUAS fases:
    // 1) Garante até MIN_PER_CATEGORY itens por categoria (bloco visual completo).
    //    Categorias menores que isso aparecem por inteiro.
    // 2) Se ainda há orçamento (remaining > 0), faz round-robin do excedente
    //    para preencher categorias maiores sem nenhuma monopolizar.
    const counts = new Map<string, number>();
    grouped.sections.forEach((s) => counts.set(s.slug, 0));
    // Fase 1 — bloco mínimo por categoria.
    for (const s of grouped.sections) {
      if (remaining <= 0) break;
      const want = Math.min(MIN_PER_CATEGORY, s.items.length, remaining);
      counts.set(s.slug, want);
      remaining -= want;
    }
    // Fase 2 — round-robin do excedente.
    let progress = true;
    while (remaining > 0 && progress) {
      progress = false;
      for (const s of grouped.sections) {
        if (remaining <= 0) break;
        const taken = counts.get(s.slug) ?? 0;
        if (taken < s.items.length) {
          counts.set(s.slug, taken + 1);
          remaining -= 1;
          progress = true;
        }
      }
    }
    const sections = grouped.sections
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        items: s.items.slice(0, counts.get(s.slug) ?? 0),
      }))
      .filter((s) => s.items.length > 0);
    return { promos, sections };
  }, [grouped, visibleCount]);

  const totalAvailable = useMemo(
    () =>
      grouped.promos.length +
      grouped.sections.reduce((acc, s) => acc + s.items.length, 0),
    [grouped]
  );

  const hasMore = visibleCount < totalAvailable;

  // IntersectionObserver para carregar mais ao se aproximar do fim da lista
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    // Throttle: evita disparos em rajada quando o sentinel fica
    // continuamente dentro da margem após cada batch carregado.
    let pending = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (pending) return;
        if (entries.some((e) => e.isIntersecting)) {
          pending = true;
          setVisibleCount((c) => c + PAGE_SIZE);
          // Libera o próximo disparo só depois do próximo frame, dando
          // tempo do React commitar e o sentinel reposicionar.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { pending = false; });
          });
        }
      },
      // 300px é suficiente pra começar a carregar antes do usuário ver o fim,
      // sem manter o sentinel "permanentemente intersectando" e disparando loop.
      { rootMargin: "300px 0px" }
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
    // Pseudo-categoria "Promoções": conta produtos com desconto real.
    const promoCount = products.reduce((acc, p) => acc + (discountPctOf(p) > 0 ? 1 : 0), 0);
    map.set("__promos__", promoCount);
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
                const c =
                  slug === "__promos__"
                    ? { slug: "__promos__", name: "Promoções" }
                    : categories.find((x) => x.slug === slug);
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
          {/* overflow-anchor:none impede o navegador de "puxar" o scroll
              quando novos cards são inseridos pelo infinite scroll —
              evita a sensação de a página subir sozinha no mobile. */}
          <div className="space-y-12 pb-16 [overflow-anchor:none]">
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
                {/* Layout uniforme: Promoções + Categorias com mesma ordenação
                    e mesma paginação, independente do sort escolhido. */}
                {paginated.promos.length > 0 && (
                  <Section
                    title="Promoções"
                    items={paginated.promos}
                    total={grouped.promos.length}
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
                    total={grouped.sections.find((g) => g.slug === s.slug)?.items.length ?? s.items.length}
                    onAdd={handleAdd}
                    onPrefetch={prefetchProduct}
                    onPrefetchFull={prefetchProductFull}
                  />
                ))}
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
                {[
                  { id: "__promos__", slug: "__promos__", name: "Promoções" } as { id: string; slug: string; name: string },
                  ...[...categories].sort((a, b) => {
                    const aTirz = isTirzepatidaCategory(a) ? 0 : 1;
                    const bTirz = isTirzepatidaCategory(b) ? 0 : 1;
                    if (aTirz !== bTirz) return aTirz - bTirz;
                    return 0;
                  }),
                ].map((c) => {
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
  total,
  onAdd,
  onPrefetch,
  onPrefetchFull,
}: {
  title: string;
  items: Product[];
  total?: number;
  onAdd: (p: Product, finalPrice: number) => void;
  onPrefetch?: (slug: string) => void;
  onPrefetchFull?: (p: Product) => void;
}) {
  if (items.length === 0) return null;
  const shown = items.length;
  const totalCount = total ?? shown;
  const showingPartial = totalCount > shown;
  return (
    <div style={{ contentVisibility: "auto", containIntrinsicSize: "1px 600px" }}>
      <div className="mb-4 md:mb-6 flex items-baseline justify-between gap-3">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <span className="text-[11px] md:text-xs text-muted-foreground tabular-nums">
          {showingPartial
            ? `${shown} de ${totalCount}`
            : `${shown} ${shown === 1 ? "item" : "itens"}`}
        </span>
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
  // Apenas um badge prioritário por card. Oferta vira só o "-x%" colorido.
  const badge = isOut
    ? { label: "Esgotado", cls: "bg-foreground/85 text-background" }
    : isNew && !hasRealSale
    ? { label: "Novo", cls: "bg-foreground/85 text-background" }
    : null;
  return (
            <Link
              ref={linkRef}
              to={`/produto/${p.slug}`}
              onMouseEnter={() => onPrefetch?.(p.slug)}
              onTouchStart={() => onPrefetch?.(p.slug)}
              className={`group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-card)] transition-all ${isOut ? "opacity-70" : ""}`}
            >
              {/* Imagem */}
              <div className="relative aspect-square overflow-hidden bg-white">
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
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  );
                })()}
                {badge && (
                  <span className={`absolute top-2 left-2 inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
                {hasRealSale && !isOut && (
                  <span className="badge-pill absolute top-2 right-2 bg-secondary text-secondary-foreground font-bold shadow-sm">
                    -{discountPct}%
                  </span>
                )}
                <WishlistButton
                  productId={p.id}
                  size="sm"
                  className={hasRealSale && !isOut ? "absolute bottom-2 right-2" : "absolute top-2 right-2"}
                />
              </div>

              {/* Conteúdo — hierarquia clara para conversão.
                  - `min-h` no título e no bloco de preço reserva o espaço da linha
                    "de R$X" (riscado) mesmo quando não há promoção: assim os botões
                    "Comprar" alinham perfeitamente entre cards lado-a-lado.
                  - `mt-auto` no botão garante que ele cole na base do card
                    independentemente do tamanho do título. */}
              <div className="pt-3 pb-3 px-2.5 flex-1 flex flex-col">
                <h3 className="font-medium text-[13px] sm:text-sm leading-snug line-clamp-2 min-h-[2.4rem] text-foreground">
                  {p.name}
                </h3>
                <div className="mt-2 flex flex-col gap-0.5 min-h-[2.75rem] sm:min-h-[3rem] justify-end">
                  {hasRealSale ? (
                    <span className="text-[11px] text-muted-foreground line-through tabular-nums leading-none">
                      de {formatBRL(priceNum)}
                    </span>
                  ) : (
                    <span aria-hidden className="text-[11px] leading-none invisible">.</span>
                  )}
                  <span className="text-base md:text-lg font-extrabold text-primary tabular-nums leading-tight">
                    {formatBRL(finalPrice)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOut) return;
                    onAdd(p, finalPrice);
                  }}
                  disabled={isOut}
                  aria-label={isOut ? "Esgotado" : `Comprar ${p.name}`}
                  className="mt-auto pt-2.5 inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90 active:scale-[0.98] transition-all rounded-full w-full text-xs h-10 shadow-sm shadow-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  {isOut ? (
                    "Esgotado"
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Comprar
                    </>
                  )}
                </button>
              </div>
            </Link>
          );
});
