import { memo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { getProductPricing } from "@/lib/catalog";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/hooks/useProducts";

/**
 * Card unificado de produto — usado no Catalog (grids principais).
 *
 * Regras de badge (canto superior esquerdo, APENAS UM por vez):
 *  ESGOTADO (destructive) > LANÇAMENTO (launch) > -X% OFF (secondary) > OFERTA (destructive)
 *
 * Canto inferior esquerdo: "Últimas N" quando stock <= 5 (escassez).
 * Canto inferior direito: WishlistButton.
 */
export const ProductCard = memo(function ProductCard({
  p,
  index,
  onAdd,
  onPrefetch,
  onPrefetchFull,
  badgeNewDays = 30,
}: {
  p: ProductRow;
  index: number;
  onAdd: (p: ProductRow, finalPrice: number) => void;
  onPrefetch?: (slug: string) => void;
  onPrefetchFull?: (p: ProductRow) => void;
  badgeNewDays?: number;
}) {
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  // Ao primeiro intersect prefetch full e desconecta. rootMargin antecipa o viewport.
  useEffect(() => {
    if (!onPrefetchFull) return;
    const el = linkRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
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
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer != null) clearTimeout(timer);
    };
  }, [p.slug, onPrefetchFull]);

  void badgeNewDays;

  const { hasSale, discountPct, finalPrice, basePrice } = getProductPricing(p);
  const isOut = (p.stock ?? 0) <= 0;
  const createdMs = p.created_at ? new Date(p.created_at).getTime() : NaN;
  const ageDays = Number.isFinite(createdMs) ? (Date.now() - createdMs) / 86400000 : Infinity;
  const _isNew = !isOut && ageDays <= badgeNewDays;
  void _isNew;
  const isLaunch = !!p.is_new_release;
  const isOffer = !!p.is_on_offer;

  /* Classe compartilhada dos badges de canto — posicionamento + estética de produto */
  const cornerBadge = "absolute top-2.5 left-2.5 z-[1] shadow-sm backdrop-blur-sm uppercase tracking-wider font-extrabold";

  return (
    <Link
      ref={linkRef}
      to={`/produto/${p.slug}`}
      onMouseEnter={() => onPrefetch?.(p.slug)}
      onTouchStart={() => onPrefetch?.(p.slug)}
      className={`product-card group relative ${isOut ? "opacity-70" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-white p-3 sm:p-5 flex items-center justify-center group-hover:bg-muted/5 transition-colors">
        {(() => {
          const r = responsiveImage(
            p.image_url,
            "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
            { quality: 65, widths: [200, 300, 400, 560, 800], fallbackWidth: 400 },
          );
          const isAboveFold = index < 4;
          return (
            <img
              src={r.src}
              srcSet={r.srcSet || undefined}
              sizes={r.sizes}
              alt={p.name}
              loading={isAboveFold ? "eager" : "lazy"}
              decoding="async"
              {...(isAboveFold ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
              width={400}
              height={400}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/no-image.svg"; }}
              className="max-w-[92%] max-h-[92%] w-auto h-auto object-contain mx-auto transition-transform duration-500 group-hover:scale-105"
            />
          );
        })()}

        {/* Badge de status — apenas um por vez (prioridade fixa) */}
        {isOut && (
          <Badge variant="destructive" className={cornerBadge}>ESGOTADO</Badge>
        )}
        {!isOut && isLaunch && (
          <Badge variant="launch" className={cornerBadge}>LANÇAMENTO</Badge>
        )}
        {!isOut && !isLaunch && hasSale && (
          <Badge variant="secondary" className={cornerBadge}>-{discountPct}% OFF</Badge>
        )}
        {!isOut && !isLaunch && !hasSale && isOffer && (
          <Badge variant="destructive" className={cornerBadge}>OFERTA</Badge>
        )}

        {/* Escassez: stock <= 5 (canto inferior esquerdo) */}
        {!isOut && (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
          <Badge
            variant="warning"
            className="absolute bottom-2 left-2 z-[1] shadow-sm uppercase tracking-wider font-extrabold"
          >
            Últimas {p.stock}
          </Badge>
        )}

        <WishlistButton
          productId={p.id}
          size="sm"
          className="absolute bottom-2 right-2 z-[1] bg-white/90 hover:bg-white shadow-sm rounded-full"
        />
      </div>

      <div className="flex flex-col flex-1 px-3 pt-2 pb-3 sm:px-3.5 sm:pt-3 sm:pb-4">
        <h3 className="font-semibold text-sm-plus sm:text-sm leading-snug text-foreground line-clamp-2 min-h-[2.8em]">
          {p.name}
        </h3>

        {/* Bloco de preço — PIX como protagonista (verde, dominante) */}
        <div className="mt-auto pt-2 leading-tight min-h-[58px] sm:min-h-[68px] flex flex-col justify-end">
          {hasSale ? (
            <div className="text-2xs sm:text-xs text-oldPrice font-medium line-through tabular-nums opacity-80">
              {formatBRL(basePrice)}
            </div>
          ) : (
            <div aria-hidden className="h-[14px] sm:h-[16px]" />
          )}
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-price sm:text-xl font-extrabold text-success tabular-nums tracking-tight leading-none">
              {formatBRL(finalPrice * 0.95)}
            </span>
            <span className="text-2xs font-bold uppercase tracking-wider text-success/80 leading-none whitespace-nowrap">
              no PIX
            </span>
          </div>
          <div className="text-2xs sm:text-xs text-muted-foreground tabular-nums leading-tight mt-0.5">
            ou {formatBRL(finalPrice)}
            <span className="hidden sm:inline"> · 3x de {formatBRL(finalPrice / 3)} sem juros</span>
          </div>
        </div>

        <Button
          variant="cta"
          size="default"
          disabled={isOut}
          className="mt-3 w-full px-0 gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOut) return;
            onAdd(p, finalPrice);
          }}
        >
          <ShoppingCart className="h-4 w-4" strokeWidth={2.2} />
          Comprar
        </Button>
      </div>
    </Link>
  );
});
