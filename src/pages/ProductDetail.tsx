import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Truck, Lock, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
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
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 lg:gap-12">
        {/* Image */}
        <div className="space-y-3">
          <div className="aspect-square rounded-3xl border border-border bg-white overflow-hidden flex items-center justify-center p-4 shadow-sm">
            <img
              src={p.image_url || "/assets/no-image.svg"}
              alt={p.name}
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
    </div>
  );
}
