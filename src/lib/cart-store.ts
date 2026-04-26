import { create } from "zustand";

// Lightweight Zustand-like store sem dependência extra
type Listener = () => void;

export interface CartLine {
  product_id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string | null;
  qty: number;
}

const STORAGE_KEY = "gimports-cart-v1";

let lines: CartLine[] = [];
let drawerOpen = false;
const listeners = new Set<Listener>();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) lines = JSON.parse(raw);
  } catch {}
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {}
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") load();

export const cart = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getLines: () => lines,
  getCount: () => lines.reduce((s, l) => s + l.qty, 0),
  getTotal: () => lines.reduce((s, l) => s + l.price * l.qty, 0),
  isOpen: () => drawerOpen,
  add(line: Omit<CartLine, "qty">, qty = 1) {
    const i = lines.findIndex((l) => l.product_id === line.product_id);
    if (i >= 0) lines[i].qty += qty;
    else lines.push({ ...line, qty });
    persist();
  },
  setQty(product_id: string, qty: number) {
    const i = lines.findIndex((l) => l.product_id === product_id);
    if (i < 0) return;
    if (qty <= 0) lines.splice(i, 1);
    else lines[i].qty = qty;
    persist();
  },
  remove(product_id: string) {
    lines = lines.filter((l) => l.product_id !== product_id);
    persist();
  },
  clear() {
    lines = [];
    persist();
  },
  openDrawer() {
    drawerOpen = true;
    listeners.forEach((l) => l());
  },
  closeDrawer() {
    drawerOpen = false;
    listeners.forEach((l) => l());
  },
};
