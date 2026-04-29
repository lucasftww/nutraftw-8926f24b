import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Zap, ShieldCheck, Truck, Lock, Package, CreditCard } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useRegisterCurrentProduct } from "@/contexts/CurrentProductContext";
import { useProductBySlug, useRelatedProducts } from "@/hooks/useProducts";

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, isLoading: loading } = useProductBySlug(slug);
  const { data: related = [] } = useRelatedProducts(p?.category_id, p?.id);
  const { add, openCart } = useCart();
  const nav = useNavigate();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
                { "@type": "ListItem", position: 1, name: "Início", item: `${origin}/` },
                ...(p.category
                  ? [
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: p.category.name,
                        item: `${origin}/?categoria=${p.category.slug}`,
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
    <section className="py-5 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full pb-28 sm:pb-10">
      {/* Breadcrumbs — reforçam a navegação até o Catálogo sem duplicar links */}
      <nav aria-label="Breadcrumb" className="mb-5">
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

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-start">
        {/* Image */}
        <div className="relative rounded-3xl border border-border/60 overflow-hidden bg-white shadow-[var(--shadow-card)] w-full max-w-md mx-auto lg:max-w-none lg:sticky lg:top-20">
          {(() => {
            const hero = responsiveImage(
              p.image_url,
              "(max-width: 1024px) 100vw, 50vw",
              { fallbackWidth: 800, quality: 80 }
            );
            return (
              <img
                src={hero.src}
                srcSet={hero.srcSet || undefined}
                sizes={hero.sizes}
                alt={p.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={800}
                height={800}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
                className="w-full h-full object-cover aspect-square"
              />
            );
          })()}
          {hasSale && (
            <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-secondary text-white text-sm font-extrabold px-3 py-1 shadow-lg">
              -{discountPct}% OFF
            </span>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5 w-full max-w-md mx-auto lg:max-w-none">
          <div className="text-center lg:text-left">
            {p.category && (
              <Link
                to={`/?categoria=${p.category.slug}`}
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.12em] text-secondary hover:underline"
              >
                {p.category.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground mt-2 leading-tight tracking-tight">
              {p.name}
            </h1>
          </div>

          {/* Price card — bloco principal de conversão */}
          <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.05] to-secondary/[0.05] p-5 sm:p-6 shadow-[var(--shadow-soft)]">
            {hasSale && (
              <div className="flex items-center justify-center lg:justify-start mb-1">
                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  De {formatBRL(Number(p.price))}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-center lg:justify-start gap-2 flex-wrap">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary tabular-nums leading-none">
                {formatBRL(finalPrice)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-center lg:justify-start gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                ou <span className="font-bold text-foreground">3x de {formatBRL(finalPrice / 3)}</span> sem juros
              </span>
            </div>
            {hasSale && (
              <p className="mt-2 text-xs font-semibold text-success text-center lg:text-left">
                Você economiza {formatBRL(Number(p.price) - finalPrice)}
              </p>
            )}
          </div>

          {/* CTAs — Comprar agora (primário) + Adicionar (secundário) */}
          <div className="space-y-2.5">
            <Button
              disabled={(p.stock ?? 0) <= 0}
              className="w-full h-14 rounded-2xl text-base font-extrabold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/30 active:scale-[0.99] transition-all"
              onClick={() => {
                if ((p.stock ?? 0) <= 0) return;
                add(
                  { product_id: p.id, slug: p.slug, name: p.name, price: finalPrice, image_url: p.image_url },
                  1
                );
                nav("/checkout");
              }}
            >
              <Zap className="w-5 h-5 mr-2" fill="currentColor" />
              {(p.stock ?? 0) <= 0 ? "Esgotado" : "Comprar agora"}
            </Button>
            <Button
              variant="outline"
              disabled={(p.stock ?? 0) <= 0}
              className="w-full h-12 rounded-2xl text-sm font-semibold border-primary/25 text-primary hover:bg-primary/5"
              onClick={() => {
                add(
                  { product_id: p.id, slug: p.slug, name: p.name, price: finalPrice, image_url: p.image_url },
                  1
                );
                openCart();
              }}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Adicionar ao carrinho
            </Button>
            {(p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
              <p className="text-center text-xs font-semibold text-secondary flex items-center justify-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Restam apenas {p.stock} unidades
              </p>
            )}
          </div>

          {/* Selos de confiança */}
          <ul className="grid grid-cols-3 gap-2">
            {[
              { icon: Truck, label: "Envio Brasil" },
              { icon: ShieldCheck, label: "Original" },
              { icon: Lock, label: "Pgto seguro" },
            ].map((b) => (
              <li
                key={b.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-muted/30 py-3 px-1 text-center"
              >
                <b.icon className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">
                  {b.label}
                </span>
              </li>
            ))}
          </ul>

          {/* Descrição */}
          {p.description && (
            <div className="pt-2">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">
                Sobre o produto
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-base">
                {p.description}
              </p>
            </div>
          )}

          {/* Tech sheet */}
          {(p.active_principle || p.composition) && (
            <div className="space-y-3 text-sm bg-muted/40 rounded-2xl p-4 border border-border/50">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Ficha técnica
              </h2>
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
        </div>
      </div>

      {/* Produtos relacionados */}
      {related.length > 0 && (
        <section className="mt-14 pt-10 border-t border-border">
          <div className="mb-5 md:mb-7 flex items-end justify-between gap-3">
            <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground">
              {p.category ? `Mais de ${p.category.name}` : "Você também pode gostar"}
            </h2>
            {p.category && (
              <Link
                to={`/?categoria=${p.category.slug}`}
                className="text-xs sm:text-sm font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Ver tudo →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {related.map((r) => {
              const rPrice = Number(r.price);
              const rSale = r.sale_price != null ? Number(r.sale_price) : 0;
              const rHasSale = rSale > 0 && rSale < rPrice;
              const rFinal = rHasSale ? rSale : rPrice;
              const rPct = rHasSale ? Math.round((1 - rSale / rPrice) * 100) : 0;
              return (
                <Link
                  key={r.id}
                  to={`/produto/${r.slug}`}
                  className="group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-card)] transition-all"
                >
                  <div className="relative aspect-square overflow-hidden bg-white">
                    <img
                      src={imageUrl(r.image_url, { width: 480, quality: 75 })}
                      alt={r.name}
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={400}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    {rHasSale && (
                      <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 shadow-sm">
                        -{rPct}%
                      </span>
                    )}
                  </div>
                  <div className="pt-3 pb-3 px-2.5">
                    <h3 className="font-medium text-[13px] sm:text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">
                      {r.name}
                    </h3>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {rHasSale && (
                        <span className="text-[11px] text-muted-foreground line-through tabular-nums leading-none">
                          de {formatBRL(rPrice)}
                        </span>
                      )}
                      <span className="text-base md:text-lg font-extrabold text-primary tabular-nums leading-tight">
                        {formatBRL(rFinal)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums">
                        ou 3x de {formatBRL(rFinal / 3)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Sticky CTA mobile — sempre visível, intenção de compra */}
      {(p.stock ?? 0) > 0 && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="block text-xl font-extrabold text-primary leading-none tabular-nums">
                {formatBRL(finalPrice)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                em 3x sem juros
              </p>
            </div>
            <Button
              className="h-12 px-6 rounded-2xl text-sm font-extrabold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/30 whitespace-nowrap active:scale-[0.98] transition-all"
              onClick={() => {
                add(
                  { product_id: p.id, slug: p.slug, name: p.name, price: finalPrice, image_url: p.image_url },
                  1
                );
                nav("/checkout");
              }}
            >
              <Zap className="w-4 h-4 mr-1.5" fill="currentColor" />
              Comprar agora
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
