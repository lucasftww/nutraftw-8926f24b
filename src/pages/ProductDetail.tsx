import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";
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

  return (
    <section className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      <Link
        to="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground h-12 font-medium mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Voltar para produtos
      </Link>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Image */}
        <div className="relative rounded-3xl border border-border/60 overflow-hidden bg-muted/20 shadow-sm">
          <img
            src={p.image_url || "/assets/no-image.svg"}
            alt={p.name}
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover aspect-square"
          />
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            {p.category && (
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {p.category.name}
              </p>
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
            <div className="space-y-3 text-sm bg-muted/40 rounded-2xl p-4 border border-border/50">
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

          {/* Price card */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              {hasSale && (
                <span className="text-base text-muted-foreground line-through">
                  {formatBRL(Number(p.price))}
                </span>
              )}
              <span className="text-3xl font-bold text-primary">
                {formatBRL(finalPrice)}
              </span>
            </div>
          </div>

          {/* CTA */}
          <Button
            className="w-full h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 border border-primary/20 transition-all"
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
            <ShoppingCart className="w-5 h-5 mr-2" />
            Adicionar ao carrinho
          </Button>
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
    </section>
  );
}
