import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ShoppingCart, ShieldCheck, Truck, Package, CreditCard, MessageCircle, QrCode, ChevronDown } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { responsiveImage, imageUrl } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ShippingCalculator } from "@/components/product/ShippingCalculator";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";
import { useRegisterCurrentProduct } from "@/contexts/CurrentProductContext";
import { useProductBySlug, useRelatedProducts } from "@/hooks/useProducts";
import { trackEvent } from "@/lib/analytics";

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, isLoading: loading } = useProductBySlug(slug);
  const { data: related = [] } = useRelatedProducts(p?.category_id, p?.id);
  const { add, openCart } = useCart();
  const nav = useNavigate();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Considera "promoção real" apenas quando o desconto arredondado for >= 1%.
  // Evita mostrar "-0% OFF" quando o sale_price é praticamente igual ao price
  // (ex.: ajustes finos de centavos não devem aparecer como oferta).
  const earlyPct = p
    ? p.sale_price != null &&
      Number(p.sale_price) > 0 &&
      Number(p.sale_price) < Number(p.price)
      ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100)
      : 0
    : 0;
  const hasSaleEarly = earlyPct >= 1;
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

  // Registra view do produto no funil (deduplicado por 30min via analytics).
  useEffect(() => {
    if (p?.id) void trackEvent("view", p.id);
  }, [p?.id]);

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

  // Mesma trava do `earlyPct`: só mostra promoção quando ≥ 1%.
  const rawDiscountPct =
    p.sale_price != null &&
    Number(p.sale_price) > 0 &&
    Number(p.sale_price) < Number(p.price)
      ? Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100)
      : 0;
  const hasSale = rawDiscountPct >= 1;
  const finalPrice = hasSale ? Number(p.sale_price) : Number(p.price);
  const discountPct = hasSale ? rawDiscountPct : 0;

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
              className="text-foreground font-medium line-clamp-2 leading-snug"
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
            <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-secondary text-secondary-foreground text-sm font-extrabold px-3 py-1 shadow-lg">
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
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-[var(--shadow-card)]">
            {hasSale && (
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                {/* Pílula verde de economia — gatilho de conversão acima do preço.
                    Mais visível que o "Você economiza" cinza embaixo. */}
                <span className="inline-flex items-center rounded-full bg-success/10 text-success px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                  Economize {formatBRL(Number(p.price) - finalPrice)} (-{discountPct}%)
                </span>
                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  {formatBRL(Number(p.price))}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-center lg:justify-start gap-2 flex-wrap">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums leading-none bg-gradient-price bg-clip-text text-transparent">
                {formatBRL(finalPrice)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-center lg:justify-start gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                ou <span className="font-bold text-foreground">3x de {formatBRL(finalPrice / 3)}</span> sem juros
              </span>
            </div>
            {/* PIX em destaque — antecipa o desconto que só aparecia no checkout.
                Reduz fricção: cliente já decide com o preço final no PIX visível. */}
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-success/8 border border-success/20 px-3 py-2.5">
              <QrCode className="h-5 w-5 text-success shrink-0" strokeWidth={2.25} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-success leading-none">
                  No PIX
                </p>
                <p className="text-base font-extrabold text-foreground tabular-nums leading-tight mt-0.5">
                  {formatBRL(finalPrice * 0.95)}{" "}
                  <span className="text-[11px] font-semibold text-success uppercase tracking-wider align-middle">
                    5% off
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* CTA único — "Comprar agora" como ação primária. Secundária
              vira link de texto pequeno para reduzir competição visual. */}
          <div className="space-y-2">
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
              <ShoppingCart className="w-4 h-4 mr-2" strokeWidth={2.5} />
              {(p.stock ?? 0) <= 0 ? "Esgotado" : "Comprar agora"}
            </Button>
            {(p.stock ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  add(
                    { product_id: p.id, slug: p.slug, name: p.name, price: finalPrice, image_url: p.image_url },
                    1
                  );
                  openCart();
                }}
                className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md py-1"
              >
                ou adicionar ao carrinho
              </button>
            )}
            <WishlistButton productId={p.id} variant="inline" className="w-full justify-center text-muted-foreground hover:text-foreground" />
            {(p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
              <p className="text-center text-xs font-bold text-destructive flex items-center justify-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {p.stock === 1 ? "Última unidade disponível!" : `Restam apenas ${p.stock} unidades`}
              </p>
            )}
          </div>

          {/* Selos de confiança — linha horizontal fina, sem caixas. */}
          <ul className="flex items-center justify-center lg:justify-start gap-x-5 gap-y-2 flex-wrap text-[12px] text-muted-foreground">
            {[
              { icon: Truck, label: "Envio nacional" },
              { icon: ShieldCheck, label: "100% original" },
              { icon: MessageCircle, label: "Suporte WhatsApp" },
            ].map((b) => (
              <li key={b.label} className="inline-flex items-center gap-1.5">
                <b.icon className="h-3.5 w-3.5 text-primary/80" strokeWidth={1.75} />
                <span className="font-medium text-foreground/80">{b.label}</span>
              </li>
            ))}
          </ul>

          {/* Calculadora de frete — reduz abandono no checkout */}
          <ShippingCalculator />

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
              // Trava `>= 1%` para evitar exibição de "-0%" em promoções marginais.
              const rRawPct = rSale > 0 && rSale < rPrice ? Math.round((1 - rSale / rPrice) * 100) : 0;
              const rHasSale = rRawPct >= 1;
              const rFinal = rHasSale ? rSale : rPrice;
              const rPct = rHasSale ? rRawPct : 0;
              return (
                <Link
                  key={r.id}
                  to={`/produto/${r.slug}`}
                  className="group flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-card)] transition-all"
                >
                  <div className="relative aspect-square overflow-hidden bg-white">
                    {(() => {
                      const ri = responsiveImage(
                        r.image_url,
                        "(max-width: 640px) 50vw, 25vw",
                        { fallbackWidth: 400 }
                      );
                      return (
                        <img
                          src={ri.src}
                          srcSet={ri.srcSet || undefined}
                          sizes={ri.sizes}
                          alt={r.name}
                          loading="lazy"
                          decoding="async"
                          width={400}
                          height={400}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      );
                    })()}
                    {rHasSale && (
                      <span className="badge-pill absolute top-2 right-2 bg-secondary text-secondary-foreground font-bold shadow-sm">
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
                        <span className="text-caption text-muted-foreground line-through tabular-nums">
                          de {formatBRL(rPrice)}
                        </span>
                      )}
                      <span className="text-base md:text-lg font-extrabold text-primary tabular-nums leading-tight">
                        {formatBRL(rFinal)}
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
            {/* Mini-thumb — reforça contexto do produto enquanto o usuário rola */}
            <img
              src={imageUrl(p.image_url, { width: 96, quality: 70 })}
              alt=""
              aria-hidden="true"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-cover bg-white border border-border shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
            />
            <div className="flex-1 min-w-0 leading-tight">
              <span className="block text-base font-extrabold text-primary tabular-nums">
                {formatBRL(finalPrice)}
              </span>
              <span className="block text-[11px] text-success font-semibold tabular-nums">
                PIX {formatBRL(finalPrice * 0.95)}
              </span>
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
              <ShoppingCart className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
              Comprar agora
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
