import { X, Minus, Plus, ShoppingBag, ArrowRight, Trash2, Lock, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { formatBRL } from "@/lib/utils";
import { imageUrl } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CouponInput } from "@/components/cart/CouponInput";
import { prefetchCheckout } from "@/App";
import { prefetchImage } from "@/lib/prefetch";
import { CART_MAX_QTY_PER_ITEM } from "@/lib/cart-store";
import { useFreeShippingMin } from "@/hooks/useFreeShippingMin";

export function CartDrawer() {
  const { lines, total, open, closeCart, setQty, remove } = useCart();
  const nav = useNavigate();

  useBodyScrollLock(open);

  // Focus trap + ESC + restauração de foco para o carrinho.
  const drawerRef = useFocusTrap<HTMLElement>(open, closeCart);

  // Pré-carrega o chunk do Checkout assim que o carrinho abre com itens.
  // Quando o usuário clicar em "Finalizar pedido", o JS já está pronto
  // → navegação instantânea (elimina o spinner/atraso no mobile).
  // Chave estável que muda quando o conjunto de imagens a pré-carregar muda
  // (qty não importa para prefetch — só a lista de produtos).
  const prefetchKey = lines.map((l) => l.product_id).join(",");
  useEffect(() => {
    if (open && lines.length > 0) {
      prefetchCheckout().catch(() => {});
      // Aquece o cache HTTP/SW com as imagens que serão exibidas no resumo
      // do checkout (44px @1x/2x). Quando o usuário entrar, elas já estarão
      // prontas — elimina o "pop-in" visual no mobile.
      for (const l of lines) {
        prefetchImage(imageUrl(l.image_url, { width: 88, quality: 75 }));
        prefetchImage(imageUrl(l.image_url, { width: 176, quality: 75 }));
      }
    }
  }, [open, prefetchKey]);

  const itemCount = lines.reduce((acc, l) => acc + l.qty, 0);
  const installment = total / 3;

  // Threshold de frete grátis vindo do admin (site_settings.free_shipping_min)
  // — fallback R$ 800 quando não configurado.
  const freeShippingMin = useFreeShippingMin();
  const remainingForFreeShipping = Math.max(0, freeShippingMin - total);
  const freeShippingProgress = Math.min(100, (total / freeShippingMin) * 100);
  const hasFreeShipping = remainingForFreeShipping === 0;

  return (
    <>
      <div
        onClick={closeCart}
        className={`fixed inset-0 bg-foreground/50 backdrop-blur-[2px] z-50 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        tabIndex={-1}
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-background z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header sticky — sempre visível durante a rolagem */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border bg-background/95 backdrop-blur-md shadow-[0_2px_12px_-8px_rgba(0,0,0,0.15)]"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.875rem)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-9 w-9 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4.5 w-4.5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold leading-none">
                  {itemCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-bold leading-tight truncate">
                Seu carrinho
              </h3>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {itemCount === 0
                  ? "Vazio"
                  : `${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
              </p>
            </div>
          </div>
          <button
            onClick={closeCart}
            aria-label="Fechar carrinho"
            className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Lista rolável — único elemento que scrolla */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center mb-4">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <h4 className="font-semibold text-foreground">Seu carrinho está vazio</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                Adicione produtos do catálogo para começar.
              </p>
              <button
                onClick={closeCart}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Explorar catálogo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="flex gap-3 p-2.5 rounded-2xl border border-border bg-muted/30"
                >
                  <img
                    src={imageUrl(l.image_url, { width: 160, quality: 75 })}
                    srcSet={`${imageUrl(l.image_url, { width: 160, quality: 75 })} 1x, ${imageUrl(l.image_url, { width: 320, quality: 75 })} 2x`}
                    alt={l.name}
                    loading="lazy"
                    decoding="async"
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-xl object-contain bg-white shrink-0 p-1"
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-sm leading-snug line-clamp-2">{l.name}</h4>
                      <button
                        onClick={() => remove(l.product_id)}
                        aria-label={`Remover ${l.name}`}
                        className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-extrabold text-primary tabular-nums">
                        {formatBRL(l.price * l.qty)}
                      </span>
                      <div className="flex items-center gap-1 bg-background border border-border rounded-full p-0.5">
                        <button
                          onClick={() => setQty(l.product_id, l.qty - 1)}
                          aria-label="Diminuir quantidade"
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center tabular-nums">
                          {l.qty}
                        </span>
                        <button
                          onClick={() => setQty(l.product_id, l.qty + 1)}
                          aria-label="Aumentar quantidade"
                          disabled={l.qty >= CART_MAX_QTY_PER_ITEM}
                          title={l.qty >= CART_MAX_QTY_PER_ITEM ? `Máximo de ${CART_MAX_QTY_PER_ITEM} por item` : undefined}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer sticky com resumo — sempre visível durante a rolagem */}
        {lines.length > 0 && (
          <footer
            className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] px-4 sm:px-5 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.875rem)" }}
          >
            {/* Progress bar de frete grátis — booster comprovado de AOV.
                Cliente vê EXATAMENTE quanto falta para liberar frete
                grátis, motivando upsell/adicionar mais um item. */}
            <div className="mb-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
                  <Truck className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
                  {hasFreeShipping ? (
                    <span className="text-success">Você ganhou frete grátis!</span>
                  ) : (
                    <>
                      Faltam{" "}
                      <span className="font-extrabold text-foreground tabular-nums">
                        {formatBRL(remainingForFreeShipping)}
                      </span>{" "}
                      <span className="text-muted-foreground">para frete grátis</span>
                    </>
                  )}
                </p>
              </div>
              <div
                className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-label="Progresso para frete grátis"
                aria-valuenow={Math.round(freeShippingProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    hasFreeShipping ? "bg-success" : "bg-gradient-brand"
                  }`}
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
            <div className="mb-3">
              <CouponInput />
            </div>
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="min-w-0">
                <span className="block text-[12px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                  Subtotal no PIX
                </span>
                {/* PIX é o preço-âncora — verde, grande. Cliente vê o valor
                    REAL que vai pagar ANTES de clicar em finalizar. Ancoragem
                    de preço comprovada eleva conversão em ~8-12%. */}
                <span className="block font-display text-2xl sm:text-[1.6rem] font-extrabold text-success tabular-nums leading-tight mt-1">
                  {formatBRL(total * 0.95)}
                </span>
                <span className="block text-[11.5px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                  ou {formatBRL(total)} · 3x de {formatBRL(installment)} sem juros
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 pb-1">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
            </div>
            <Button
              onClick={() => {
                closeCart();
                nav("/checkout");
              }}
              className="w-full h-12 rounded-2xl text-sm font-extrabold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/30 active:scale-[0.99] transition-all"
            >
              Finalizar pedido
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeCart}
                className="text-[12px] font-semibold text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                ← Continuar comprando
              </button>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                Pagamento seguro
              </p>
            </div>
          </footer>
        )}
      </aside>
    </>
  );
}
