import { memo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { responsiveImage } from "@/lib/image";
import { getProductPricing } from "@/lib/catalog";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { ProductRow } from "@/hooks/useProducts";

/**
 * Card unificado de produto — usado no Catalog (grids principais).
 *
 * Foi extraído de Catalog.tsx (que tinha 1.250 linhas) — agora pode ser
 * reutilizado em Wishlist, ProductDetail (related), Recommendations etc.
 * sem duplicar o layout/regras de badge/preço.
 *
 * `memo`: a lista do catálogo re-renderiza a cada keystroke da busca.
 * Sem memo, todos os ~50 cards re-renderizam mesmo se nada mudou neles.
 *
 * Regras de badges (canto superior esquerdo, APENAS UM por vez):
 *  ESGOTADO (destructive) > LANÇAMENTO (gradient brand) > -X% OFF (secondary) > OFERTA (destructive)
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
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer != null) clearTimeout(timer);
    };
    // Depender de p.slug evita reconectar a cada re-render da lista filtrada.
  }, [p.slug, onPrefetchFull]);

  // Suprime warning de "p não usado" no useEffect (depende só do slug)
  // sem mudar a semântica.
  void badgeNewDays;

  const { hasSale, discountPct, finalPrice, basePrice } = getProductPricing(p);
  const isOut = (p.stock ?? 0) <= 0;
  // `created_at` ausente/inválido → NaN; tratamos como "antigo" em vez de
  // propagar NaN pelo cálculo, que desligava silenciosamente a flag de "novo".
  const createdMs = p.created_at ? new Date(p.created_at).getTime() : NaN;
  const ageDays = Number.isFinite(createdMs) ? (Date.now() - createdMs) / 86400000 : Infinity;
  // Usa a configuração admin "badge_new_days" em vez de valor fixo.
  // Atualmente não exibe badge "Novo" próprio — reservado para futuro
  // (a prioridade ESGOTADO/LANÇAMENTO/-%/OFERTA cobre os casos atuais).
  const _isNew = !isOut && ageDays <= badgeNewDays;
  void _isNew;
  const isLaunch = !!p.is_new_release;
  const isOffer = !!p.is_on_offer;

  return (
    <Link
      ref={linkRef}
      to={`/produto/${p.slug}`}
      onMouseEnter={() => onPrefetch?.(p.slug)}
      onTouchStart={() => onPrefetch?.(p.slug)}
      className={`group relative flex flex-col h-full rounded-2xl bg-card overflow-hidden border border-border/50 ${isOut ? "opacity-70" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-white p-3 sm:p-5 flex items-center justify-center group-hover:bg-muted/5 transition-colors">
        {(() => {
          const r = responsiveImage(
            p.image_url,
            "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
            {
              // Quality 65 nas thumbs: visualmente imperceptível, ~25% mais leve.
              quality: 65,
              widths: [200, 300, 400, 560, 800],
              fallbackWidth: 400,
            },
          );
          // Os 4 primeiros cards são quase sempre o LCP no mobile (grid 2-col).
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

        {/* Badges no canto superior esquerdo — apenas UM por vez (prioridade fixa). */}
        {(() => {
          const pillBase =
            "absolute top-2.5 left-2.5 z-[1] inline-flex items-center rounded-full text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 leading-none shadow-sm backdrop-blur-sm";
          if (isOut) {
            return <span className={`${pillBase} bg-destructive text-destructive-foreground`}>ESGOTADO</span>;
          }
          if (isLaunch) {
            return <span className={`${pillBase} bg-gradient-brand text-white`}>LANÇAMENTO</span>;
          }
          if (hasSale) {
            return <span className={`${pillBase} bg-secondary text-secondary-foreground`}>-{discountPct}% OFF</span>;
          }
          if (isOffer) {
            return <span className={`${pillBase} bg-destructive text-destructive-foreground`}>OFERTA</span>;
          }
          return null;
        })()}

        {/* Escassez: "Últimas N" quando stock <= 5 (canto inferior esquerdo). */}
        {!isOut && (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
          <span className="absolute bottom-2 left-2 z-[1] inline-flex items-center gap-1 rounded-full bg-warning text-warning-foreground text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 shadow-sm">
            Últimas {p.stock}
          </span>
        )}

        <WishlistButton
          productId={p.id}
          size="sm"
          className="absolute bottom-2 right-2 z-[1] bg-white/90 hover:bg-white shadow-sm rounded-full"
        />
      </div>

      <div className="flex flex-col flex-1 px-3 pt-2 pb-3 sm:px-3.5 sm:pt-3 sm:pb-4">
        <h3 className="font-semibold text-[13px] sm:text-[14px] leading-snug text-foreground line-clamp-2 min-h-[2.8em]">
          {p.name}
        </h3>

        {/* Bloco de preço — PIX como protagonista (verde, dominante). */}
        <div className="mt-auto pt-2 leading-tight min-h-[58px] sm:min-h-[68px] flex flex-col justify-end">
          {hasSale ? (
            <div className="text-[11px] sm:text-[12px] text-oldPrice font-medium line-through tabular-nums opacity-80">
              {formatBRL(basePrice)}
            </div>
          ) : (
            <div aria-hidden className="h-[14px] sm:h-[16px]" />
          )}
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-[17px] sm:text-[20px] font-extrabold text-success tabular-nums tracking-tight leading-none">
              {formatBRL(finalPrice * 0.95)}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-success/80 leading-none whitespace-nowrap">
              no PIX
            </span>
          </div>
          <div className="text-[11px] sm:text-[12px] text-muted-foreground tabular-nums leading-tight mt-0.5">
            ou {formatBRL(finalPrice)}
            <span className="hidden sm:inline"> · 3x de {formatBRL(finalPrice / 3)} sem juros</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOut) return;
            onAdd(p, finalPrice);
          }}
          disabled={isOut}
          className="mt-3 btn-cta h-11 w-full !text-[13.5px] !gap-1.5 !px-0"
        >
          <ShoppingCart className="h-4 w-4" strokeWidth={2.2} />
          Comprar
        </button>
      </div>
    </Link>
  );
});
