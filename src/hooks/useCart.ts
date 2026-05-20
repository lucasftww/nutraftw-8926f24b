import { useSyncExternalStore } from "react";
import { cart } from "@/lib/cart-store";

// Snapshot serializado garante re-render confiável quando carrinho/drawer mudam.
const subscribe = (cb: () => void) => cart.subscribe(cb);
const getSnapshot = () =>
  JSON.stringify(cart.getLines()) + "|" + cart.isOpen() + "|" + (cart.getCoupon() ?? "");
const getServerSnapshot = () => "[]|false|";

// Actions são bindados UMA VEZ no módulo. Antes, `.bind(cart)` rodava
// em CADA render do componente que chamasse useCart → quem usasse
// `add`/`remove` como dep de useEffect/useMemo re-rodava em loop.
// Agora as refs são estáveis para a vida toda da aba.
const stableActions = {
  setCoupon: cart.setCoupon.bind(cart),
  add: cart.add.bind(cart),
  remove: cart.remove.bind(cart),
  setQty: cart.setQty.bind(cart),
  clear: cart.clear.bind(cart),
  openCart: cart.openDrawer.bind(cart),
  closeCart: cart.closeDrawer.bind(cart),
} as const;

export function useCart() {
  // useSyncExternalStore garante re-render; lemos os dados frescos do store.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    lines: cart.getLines(),
    count: cart.getCount(),
    total: cart.getTotal(),
    open: cart.isOpen(),
    coupon: cart.getCoupon(),
    ...stableActions,
  };
}
