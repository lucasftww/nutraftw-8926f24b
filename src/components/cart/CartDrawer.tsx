import { X, Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export function CartDrawer() {
  const { lines, total, open, closeCart, setQty, remove } = useCart();
  const nav = useNavigate();

  useBodyScrollLock(open);

  return (
    <>
      <div
        onClick={closeCart}
        className={`fixed inset-0 bg-black/50 z-50 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Seu carrinho
          </h3>
          <button onClick={closeCart} className="p-2 hover:bg-muted rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
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
            <div className="space-y-4">
              {lines.map((l) => (
                <div key={l.product_id} className="flex gap-4 p-3 rounded-2xl border border-border bg-muted/30">
                  <img
                    src={l.image_url || "/assets/no-image.svg"}
                    alt={l.name}
                    loading="lazy"
                    decoding="async"
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-xl object-cover bg-white"
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-sm leading-tight line-clamp-2">{l.name}</h4>
                      <button onClick={() => remove(l.product_id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-bold text-primary">{formatBRL(l.price * l.qty)}</span>
                      <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1">
                        <button onClick={() => setQty(l.product_id, l.qty - 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-medium w-5 text-center">{l.qty}</span>
                        <button onClick={() => setQty(l.product_id, l.qty + 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="font-display text-2xl font-extrabold text-primary">{formatBRL(total)}</span>
          </div>
          <Button
            disabled={lines.length === 0}
            onClick={() => {
              closeCart();
              nav("/checkout");
            }}
            className="w-full"
            size="lg"
          >
            Finalizar pedido
          </Button>
        </div>
      </aside>
    </>
  );
}
