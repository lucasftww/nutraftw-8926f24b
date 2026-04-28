import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Truck, Lock, Package, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useSEO } from "@/hooks/useSEO";

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState<any[]>([]);
  const { add, openCart } = useCart();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase
      .from("products")
      .select("*, category:categories(name, slug)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setP(data);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!p?.category_id) {
      setRelated([]);
      return;
    }
    supabase
      .from("products")
      .select("id, slug, name, price, sale_price, image_url")
      .eq("is_active", true)
      .eq("category_id", p.category_id)
      .neq("id", p.id)
      .limit(4)
      .then(({ data }) => setRelated((data as any) || []));
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
  const pixPrice = finalPrice * 0.95;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-xs sm:text-sm text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-primary transition-colors">
              Início
            </Link>
          </li>
          {p.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <li>
                <Link
                  to={`/?categoria=${p.category.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {p.category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <li className="text-foreground font-medium line-clamp-1 max-w-[60vw] sm:max-w-none">
            {p.name}
          </li>
        </ol>
        <Link
          to="/"
          className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao catálogo
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 lg:gap-12">
        {/* Image */}
        <div className="space-y-3">
          <div className="aspect-square rounded-3xl border border-border bg-white overflow-hidden flex items-center justify-center p-4 shadow-sm">
            <img
              src={p.image_url || "/assets/no-image.svg"}
              alt={p.name}
              loading="eager"
              decoding="async"
              className="w-full h-full object-contain"
            />
          </div>
          {hasSale && (
            <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive text-xs font-bold px-3 py-1.5 rounded-full">
              <span>OFERTA</span>
              <span>−{discountPct}%</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {p.category && (
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              {p.category.name}
            </span>
          )}
          <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground mt-2 mb-4">
            {p.name}
          </h1>

          <div className="mb-6">
            <div className="flex items-baseline gap-3 flex-wrap">
              {hasSale && (
                <span className="text-base text-muted-foreground line-through">
                  {formatBRL(Number(p.price))}
                </span>
              )}
              <span className="font-display text-3xl md:text-4xl font-extrabold text-primary">
                {formatBRL(finalPrice)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              ou{" "}
              <span className="font-bold text-foreground">{formatBRL(pixPrice)}</span> no PIX
              <span className="ml-1 text-secondary font-semibold">(5% off)</span>
            </p>
          </div>

          {p.description && (
            <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed whitespace-pre-line">
              {p.description}
            </p>
          )}

          {/* Tech sheet */}
          {(p.active_principle || p.composition) && (
            <div className="space-y-3 mb-6 text-sm bg-muted/40 rounded-2xl p-4 border border-border/50">
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

          {/* Quantity + CTA */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-3 bg-background border-2 border-border rounded-full p-1 h-12">
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-lg"
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Diminuir"
              >
                −
              </button>
              <span className="font-bold w-6 text-center">{qty}</span>
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-lg"
                onClick={() => setQty(qty + 1)}
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1 h-12 rounded-full"
              onClick={() => {
                add(
                  {
                    product_id: p.id,
                    slug: p.slug,
                    name: p.name,
                    price: finalPrice,
                    image_url: p.image_url,
                  },
                  qty
                );
                openCart();
              }}
            >
              Adicionar ao carrinho
            </Button>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
              <Truck className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Envio rápido</p>
                <p className="text-muted-foreground">Para todo o Brasil</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Garantia</p>
                <p className="text-muted-foreground">Produto original</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
              <Lock className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Pagamento seguro</p>
                <p className="text-muted-foreground">PIX e cartão</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
              <Package className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Embalagem discreta</p>
                <p className="text-muted-foreground">Privacidade total</p>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/5511999999999?text=${encodeURIComponent(
              `Olá! Tenho dúvidas sobre o produto: ${p.name}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 h-11 rounded-full bg-[#25D366] text-white font-semibold text-sm hover:bg-[#20bd5a] transition-colors"
          >
            Tirar dúvidas no WhatsApp
          </a>
        </div>
      </div>

      {/* Produtos relacionados */}
      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-border">
          <div className="flex items-end justify-between mb-6 gap-4">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
              {p.category ? `Mais de ${p.category.name}` : "Você também pode gostar"}
            </h2>
            {p.category && (
              <Link
                to={`/?categoria=${p.category.slug}`}
                className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Ver categoria →
              </Link>
            )}
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
                  className="group flex flex-col h-full rounded-2xl bg-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="relative aspect-square overflow-hidden bg-white rounded-2xl">
                    <img
                      src={r.image_url || "/assets/no-image.svg"}
                      alt={r.name}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
    </div>
  );
}
