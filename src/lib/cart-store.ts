// Lightweight reactive store — fonte da verdade do carrinho no cliente.
//
// Modelo:
//  - Tudo vive em localStorage (funciona 100% offline e para anônimos).
//  - Cada linha tem `updated_at` em ms — útil para futuras estratégias de
//    sincronização "última escrita ganha" caso o carrinho passe a ser
//    persistido no servidor.
//
// Sem dependência de rede: o store é puramente local. A persistência
// server-side dos itens é feita apenas no momento do checkout (RPC
// `create_order`), o que evita filas pendentes inflando o localStorage.

type Listener = () => void;

export interface CartLine {
  product_id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string | null;
  qty: number;
  /** Timestamp em ms da última modificação local desta linha. */
  updated_at: number;
}

const STORAGE_KEY = "gimports-cart-v1";
const COUPON_KEY = "gimports-coupon-v1";
// Chave legada de uma fila de operações pendentes que nunca chegou a ser
// drenada — limpamos no load para não inflar o localStorage de quem já usou
// versões anteriores do app.
const LEGACY_PENDING_KEY = "gimports-cart-pending-v1";

let lines: CartLine[] = [];
let drawerOpen = false;
let couponCode: string | null = null;
const listeners = new Set<Listener>();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        lines = parsed
          .filter((l) => l && typeof l.product_id === "string")
          .map((l) => ({
            ...l,
            updated_at: typeof l.updated_at === "number" ? l.updated_at : Date.now(),
          }));
      }
    } else {
      lines = [];
    }
  } catch {}
  try {
    const c = localStorage.getItem(COUPON_KEY);
    couponCode = c && c.length > 0 ? c : null;
  } catch {}
  // Limpa fila legada que não é mais usada (evita crescimento indefinido).
  try {
    localStorage.removeItem(LEGACY_PENDING_KEY);
  } catch {}
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    if (couponCode) localStorage.setItem(COUPON_KEY, couponCode);
    else localStorage.removeItem(COUPON_KEY);
  } catch {}
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  load();
  // Sincroniza o carrinho entre abas/janelas. Sem isto, abrir o site em
  // duas abas leva a contagens divergentes e o cliente fica confuso.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY && e.key !== COUPON_KEY) return;
    load();
    listeners.forEach((l) => l());
  });
}

export const cart = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  // Retorna cópia para evitar mutação externa do estado do store.
  getLines: () => lines.map((l) => ({ ...l })),
  getCount: () => lines.reduce((s, l) => s + l.qty, 0),
  getTotal: () => lines.reduce((s, l) => s + l.price * l.qty, 0),
  isOpen: () => drawerOpen,
  getCoupon: () => couponCode,
  setCoupon(code: string | null) {
    const next = code && code.trim().length > 0 ? code.trim().toUpperCase() : null;
    if (next === couponCode) return;
    couponCode = next;
    persist();
  },
  add(line: Omit<CartLine, "qty" | "updated_at">, qty = 1) {
    const now = Date.now();
    const i = lines.findIndex((l) => l.product_id === line.product_id);
    if (i >= 0) {
      const finalQty = lines[i].qty + qty;
      lines = lines.map((l, idx) =>
        idx === i ? { ...l, qty: finalQty, updated_at: now } : l
      );
    } else {
      lines = [...lines, { ...line, qty, updated_at: now }];
    }
    persist();
  },
  setQty(product_id: string, qty: number) {
    const now = Date.now();
    const i = lines.findIndex((l) => l.product_id === product_id);
    if (i < 0) return;
    if (qty <= 0) {
      lines = lines.filter((_, idx) => idx !== i);
    } else {
      lines = lines.map((l, idx) =>
        idx === i ? { ...l, qty, updated_at: now } : l
      );
    }
    persist();
  },
  remove(product_id: string) {
    lines = lines.filter((l) => l.product_id !== product_id);
    persist();
  },
  clear() {
    lines = [];
    couponCode = null;
    persist();
  },
  openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    listeners.forEach((l) => l());
  },
  closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    listeners.forEach((l) => l());
  },
};
