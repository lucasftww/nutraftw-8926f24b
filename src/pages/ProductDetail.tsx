import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useRegisterCurrentProduct } from "@/contexts/CurrentProductContext";

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<any[]>([]);
  const { add, openCart } = useCart();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("products")
      .select("*, category:categories(name, slug)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[ProductDetail] load failed", error);
        setP(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!p?.category_id) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("products")
      .select("id, slug, name, price, sale_price, image_url")
      .eq("is_active", true)
      .eq("category_id", p.category_id)
      .neq("id", p.id)
      .limit(4)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[ProductDetail] related failed", error);
        setRelated((data as any) || []);
      });
    return () => {
      cancelled = true;
    };
  }, [p?.category_id, p?.id]);

  const hasSaleEarly =
    p?.sale_price != null &&
    Number(p.sale_price) > 0 &&
    Number(p.sale_price) < Number(p.price);
  const finalPriceEarly = p ? (hasSaleEarly ? Number(p.sale_price) : Number(p.price)) : 0;

  useSEO(
    p
      ? {
          title: `${p.name} | GIMPORTS`,
          description:
            (p.description || `Compre ${p.name} na GIMPORTS com envio para todo o Brasil.`).slice(0, 160),
          image: p.image_url || undefined,
          type: "product",
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "Product",
              name: p.name,
              description: p.description || undefined,
              image: p.image_url || undefined,
              sku: p.id,
              category: p.category?.name,
              offers: {
                "@type": "Offer",
                priceCurrency: "BRL",
                price: finalPriceEarly.toFixed(2),
                availability: "https://schema.org/InStock",
                url: typeof window !== "undefined" ? window.location.href : undefined,
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Início", item: "/" },
                ...(p.category
                  ? [
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: p.category.name,
                        item: `/?categoria=${p.category.slug}`,
                      },
                      { "@type": "ListItem", position: 3, name: p.name },
                    ]
                  : [{ "@type": "ListItem", position: 2, name: p.name }]),
              ],
            },
          ],
        }
      : { title: "Produto | GIMPORTS" }
  );

  // Registra o produto atual para o footer (antes de qualquer early return — regra dos hooks).
  useRegisterCurrentProduct(
    p
      ? {
          name: p.name,
          slug: p.slug,
          price:
            p.sale_price != null &&
            Number(p.sale_price) > 0 &&
            Number(p.sale_price) < Number(p.price)
              ? Number(p.sale_price)
              : Number(p.price),
        }
      : null
  );

  if (loading)
    return <div className="container py-20 text-center text-muted-foreground">A carregar…</div>;
  if (!p)
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Produto não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao catálogo</Link>
        </Button>
      </div>
    );

  const hasSale =
    p.sale_price != null &&
    Number(p.sale_price) > 0 &&
    Number(p.sale_price) < Number(p.price);
  const finalPrice = hasSale ? Number(p.sale_price) : Number(p.price);
  const discountPct = hasSale
    ? Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100)
    : 0;

  return (
    <section className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Breadcrumbs — reforçam a navegação até o Catálogo sem duplicar links */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol
          className="flex items-center flex-wrap gap-1.5 text-sm text-muted-foreground"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="inline-flex items-center"
          >
            <Link
              to="/"
              itemProp="item"
              className="hover:text-primary transition-colors font-medium"
            >
              <span itemProp="name">Catálogo</span>
            </Link>
            <meta itemProp="position" content="1" />
          </li>
          <li aria-hidden="true" className="text-muted-foreground/50">
            ›
          </li>
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
            className="inline-flex items-center min-w-0"
            aria-current="page"
          >
            <span
              itemProp="name"
              className="text-foreground font-medium truncate max-w-[60vw] sm:max-w-xs"
            >
              {p.name}
            </span>
            <meta itemProp="position" content="2" />
          </li>
        </ol>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Image */}
        <div className="relative rounded-3xl border border-border/60 overflow-hidden bg-gradient-to-br from-muted/40 to-background shadow-[var(--shadow-soft)] w-full max-w-md mx-auto lg:max-w-none lg:sticky lg:top-20">
          <img
            src={p.image_url || "/assets/no-image.svg"}
            alt={p.name}
            loading="eager"
            decoding="async"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
            className="w-full h-full object-cover aspect-square"
          />
          {hasSale && (
            <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-secondary text-white text-xs font-bold px-2.5 py-1 shadow-md">
              -{discountPct}%
            </span>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5 w-full max-w-md mx-auto lg:max-w-none text-center lg:text-left">
          <div>
            {p.category && (
              <Link
                to={`/?categoria=${p.category.slug}`}
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.12em] text-secondary hover:underline"
              >
                {p.category.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-2 leading-tight">
              {p.name}
            </h1>
          </div>

          {p.description && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-base">
              {p.description}
            </p>
          )}

          {/* Tech sheet */}
          {(p.active_principle || p.composition) && (
            <div className="space-y-3 text-sm bg-muted/40 rounded-2xl p-4 border border-border/50 text-left">
              {p.active_principle && (
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="font-bold text-foreground sm:min-w-[140px]">
                    Princípio ativo:
                  </span>
                  <span className="text-muted-foreground">{p.active_principle}</span>
                </div>
              )}
              {p.composition && (
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="font-bold text-foreground sm:min-w-[140px]">Composição:</span>
                  <span className="text-muted-foreground">{p.composition}</span>
                </div>
              )}
            </div>
          )}

          {/* Price card — destaque com gradiente sutil */}
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-secondary/[0.04] p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-baseline justify-center lg:justify-start gap-3 flex-wrap">
              {hasSale && (
                <span className="text-base text-muted-foreground line-through">
                  {formatBRL(Number(p.price))}
                </span>
              )}
              <span className="text-4xl font-extrabold tracking-tight text-primary">
                {formatBRL(finalPrice)}
              </span>
              {hasSale && (
                <span className="inline-flex items-center rounded-full bg-secondary/10 text-secondary text-[11px] font-bold uppercase tracking-wide px-2 py-0.5">
                  você economiza {formatBRL(Number(p.price) - finalPrice)}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              ou em até <span className="font-semibold text-foreground">3x sem juros</span> no cartão
            </p>
          </div>

          {/* CTA */}
          <Button
            disabled={(p.stock ?? 0) <= 0}
            className="w-full h-14 rounded-xl text-base font-semibold bg-primary hover:bg-primary-glow text-primary-foreground shadow-md border border-primary/20"
            onClick={() => {
              add(
                {
                  product_id: p.id,
                  slug: p.slug,
                  name: p.name,
                  price: finalPrice,
                  image_url: p.image_url,
                },
                1
              );
              openCart();
            }}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {(p.stock ?? 0) <= 0 ? "Esgotado" : "Adicionar ao carrinho"}
          </Button>
        </div>
      </div>

      {/* Produtos relacionados */}
      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-border">
          {/* Cabeçalho de seção padronizado com o Catálogo (faixa de acento + contador) */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-end justify-between gap-4 border-b-2 border-primary/15 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className="inline-block h-7 md:h-8 w-1.5 rounded-full bg-primary shrink-0"
                />
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary leading-none truncate">
                  {p.category ? `Mais de ${p.category.name}` : "Você também pode gostar"}
                </h2>
              </div>
              <div className="shrink-0 flex items-center gap-4">
                {p.category && (
                  <Link
                    to={`/?categoria=${p.category.slug}`}
                    className="hidden sm:inline text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                  >
                    Ver categoria →
                  </Link>
                )}
                <span className="text-[12px] md:text-[13px] font-semibold text-muted-foreground tabular-nums">
                  {related.length} {related.length === 1 ? "produto" : "produtos"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {related.map((r) => {
              const rPrice = Number(r.price);
              const rSale = r.sale_price != null ? Number(r.sale_price) : 0;
              const rHasSale = rSale > 0 && rSale < rPrice;
              const rFinal = rHasSale ? rSale : rPrice;
              return (
                <Link
                  key={r.id}
                  to={`/produto/${r.slug}`}
                  className="flex flex-col h-full rounded-2xl bg-card overflow-hidden"
                >
                  <div className="relative aspect-square overflow-hidden bg-white rounded-2xl">
                    <img
                      src={r.image_url || "/assets/no-image.svg"}
                      alt={r.name}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pt-3 pb-1 px-1">
                    <h3 className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">
                      {r.name}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base font-bold text-foreground">
                        {formatBRL(rFinal)}
                      </span>
                      {rHasSale && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatBRL(rPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
