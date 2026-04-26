import { useSyncExternalStore } from "react";
import { cart, CartLine } from "@/lib/cart-store";

export function useCart() {
  const subscribe = (cb: () => void) => cart.subscribe(cb);
  const lines = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(cart.getLines()) + "|" + cart.isOpen(),
    () => "[]|false"
  );
  void lines; // ensures re-render
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
