import { useSyncExternalStore } from "react";
import { cart } from "@/lib/cart-store";

// Snapshot serializado garante re-render confiável quando carrinho/drawer mudam.
const subscribe = (cb: () => void) => cart.subscribe(cb);
const getSnapshot = () =>
  JSON.stringify(cart.getLines()) + "|" + cart.isOpen();
const getServerSnapshot = () => "[]|false";

export function useCart() {
  // useSyncExternalStore garante re-render; lemos os dados frescos do store.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    lines: cart.getLines(),
    count: cart.getCount(),
    total: cart.getTotal(),
    open: cart.isOpen(),
    add: cart.add.bind(cart),
    remove: cart.remove.bind(cart),
    setQty: cart.setQty.bind(cart),
    clear: cart.clear.bind(cart),
    openCart: cart.openDrawer.bind(cart),
    closeCart: cart.closeDrawer.bind(cart),
  };
}
