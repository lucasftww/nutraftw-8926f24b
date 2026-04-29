// Lightweight reactive store + sync offline-first com Supabase.
//
// Modelo:
//  - Tudo vive em localStorage (funciona 100% offline e para anônimos).
//  - Cada linha tem `updated_at` em ms — usado pra resolver conflitos
//    com "última escrita ganha" no merge com o servidor.
//  - Operações feitas offline (ou com falha de rede) entram numa fila
//    `pendingOps`. Quando o app detecta `online + logado`, a fila é
//    drenada via `flushPending()`.
//
// O hook `useCartSync` (em src/hooks/useCartSync.ts) orquestra:
//   - merge inicial ao logar
//   - flush ao reconectar
//   - revalidação de preços/estoque

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

/** Operação pendente — replicada no servidor quando voltar a conexão. */
export type PendingOp =
  | { kind: "upsert"; product_id: string; qty: number; at: number }
  | { kind: "remove"; product_id: string; at: number }
  | { kind: "clear"; at: number };

const STORAGE_KEY = "gimports-cart-v1";
const COUPON_KEY = "gimports-coupon-v1";
const PENDING_KEY = "gimports-cart-pending-v1";

let lines: CartLine[] = [];
let drawerOpen = false;
let couponCode: string | null = null;
let pendingOps: PendingOp[] = [];
const listeners = new Set<Listener>();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        lines = parsed
          .filter((l) => l && typeof l.product_id === "string")
          .map((l) => ({ ...l, updated_at: typeof l.updated_at === "number" ? l.updated_at : Date.now() }));
      }
    } else {
      lines = [];
    }
  } catch {}
  try {
    const c = localStorage.getItem(COUPON_KEY);
    couponCode = c && c.length > 0 ? c : null;
  } catch {}
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pendingOps = parsed;
    }
  } catch {}
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    if (couponCode) localStorage.setItem(COUPON_KEY, couponCode);
    else localStorage.removeItem(COUPON_KEY);
    if (pendingOps.length > 0) localStorage.setItem(PENDING_KEY, JSON.stringify(pendingOps));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
  listeners.forEach((l) => l());
}

function enqueue(op: PendingOp) {
  // Compacta operações redundantes para a mesma linha — evita fila inflar.
  if (op.kind === "upsert") {
    pendingOps = pendingOps.filter(
      (p) => !(p.kind === "upsert" && p.product_id === op.product_id) &&
             !(p.kind === "remove" && p.product_id === op.product_id),
    );
  } else if (op.kind === "remove") {
    pendingOps = pendingOps.filter(
      (p) => !(p.kind === "upsert" && p.product_id === op.product_id) &&
             !(p.kind === "remove" && p.product_id === op.product_id),
    );
  } else if (op.kind === "clear") {
    // Clear invalida tudo que veio antes — só ele importa.
    pendingOps = [];
  }
  pendingOps.push(op);
}

if (typeof window !== "undefined") {
  load();
  // Sincroniza o carrinho entre abas/janelas. Sem isto, abrir o site em
  // duas abas leva a contagens divergentes e o cliente fica confuso.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY && e.key !== COUPON_KEY && e.key !== PENDING_KEY) return;
    load();
    listeners.forEach((l) => l());
  });
}

export const cart = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  // Retorna cópia para evitar mutação externa do estado do store.
  getLines: () => lines.map((l) => ({ ...l })),
  getCount: () => lines.reduce((s, l) => s + l.qty, 0),
  getTotal: () => lines.reduce((s, l) => s + l.price * l.qty, 0),
  isOpen: () => drawerOpen,
  getCoupon: () => couponCode,
  getPending: () => pendingOps.slice(),
  hasPending: () => pendingOps.length > 0,
  clearPending() {
    if (pendingOps.length === 0) return;
    pendingOps = [];
    persist();
  },
  setCoupon(code: string | null) {
    const next = code && code.trim().length > 0 ? code.trim().toUpperCase() : null;
    if (next === couponCode) return;
    couponCode = next;
    persist();
  },
  add(line: Omit<CartLine, "qty" | "updated_at">, qty = 1) {
    const now = Date.now();
    const i = lines.findIndex((l) => l.product_id === line.product_id);
    let finalQty = qty;
    if (i >= 0) {
      finalQty = lines[i].qty + qty;
      // Substitui o item por uma nova referência (imutável) em vez de mutar.
      lines = lines.map((l, idx) => (idx === i ? { ...l, qty: finalQty, updated_at: now } : l));
    } else {
      lines = [...lines, { ...line, qty, updated_at: now }];
    }
    enqueue({ kind: "upsert", product_id: line.product_id, qty: finalQty, at: now });
    persist();
  },
  setQty(product_id: string, qty: number) {
    const now = Date.now();
    const i = lines.findIndex((l) => l.product_id === product_id);
    if (i < 0) return;
    if (qty <= 0) {
      lines = lines.filter((_, idx) => idx !== i);
      enqueue({ kind: "remove", product_id, at: now });
    } else {
      lines = lines.map((l, idx) => (idx === i ? { ...l, qty, updated_at: now } : l));
      enqueue({ kind: "upsert", product_id, qty, at: now });
    }
    persist();
  },
  remove(product_id: string) {
    const now = Date.now();
    lines = lines.filter((l) => l.product_id !== product_id);
    enqueue({ kind: "remove", product_id, at: now });
    persist();
  },
  clear() {
    const now = Date.now();
    lines = [];
    couponCode = null;
    enqueue({ kind: "clear", at: now });
    persist();
  },
  /**
   * Aplica resultado de merge vindo do servidor (após login/sync).
   * Não enfileira novas operações — esta é a fonte de verdade pós-merge.
   */
  replaceFromServer(serverLines: CartLine[]) {
    lines = serverLines.map((l) => ({ ...l }));
    persist();
  },
  /**
   * Atualiza preços/estoque sem alterar quantidades nem tocar na fila.
   * Usado pela revalidação ao reconectar.
   */
  refreshPrices(updates: Record<string, { price: number; available: number | null; name?: string; image_url?: string | null }>) {
    let changed = false;
    lines = lines.map((l) => {
      const u = updates[l.product_id];
      if (!u) return l;
      const nextQty = u.available != null ? Math.min(l.qty, Math.max(0, u.available)) : l.qty;
      const nextPrice = u.price;
      const nextName = u.name ?? l.name;
      const nextImg = u.image_url ?? l.image_url;
      if (
        nextPrice !== l.price ||
        nextQty !== l.qty ||
        nextName !== l.name ||
        nextImg !== l.image_url
      ) {
        changed = true;
      }
      return {
        ...l,
        price: nextPrice,
        qty: nextQty,
        name: nextName,
        image_url: nextImg,
      };
    }).filter((l) => l.qty > 0);
    if (changed) persist();
    return changed;
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
