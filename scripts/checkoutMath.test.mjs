test("range de paginação: page * size, +size-1", () => {
  const PAGE_SIZE = 30;
  const ranges = (page) => [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1];
  assert.deepEqual(ranges(0), [0, 29]);
  assert.deepEqual(ranges(1), [30, 59]);
  assert.deepEqual(ranges(5), [150, 179]);
});

test("totalPages calcula com base no totalCount", () => {
  const totalPages = (n, size) => Math.max(1, Math.ceil(n / size));
  assert.equal(totalPages(0, 30), 1);
  assert.equal(totalPages(30, 30), 1);
  assert.equal(totalPages(31, 30), 2);
  assert.equal(totalPages(150, 50), 3);
});

test("status rollback: simulação", async () => {
  let list = [{ id: "a", status: "pending" }];
  const setList = (n) => (list = n);
  // sucesso
  let prev = list[0].status;
  setList(list.map((o) => o.id === "a" ? { ...o, status: "paid" } : o));
  // simula erro → rollback
  setList(list.map((o) => o.id === "a" ? { ...o, status: prev } : o));
  assert.equal(list[0].status, "pending");
});
/**
 * Testes pequenos com `node --test` (sem precisar instalar vitest).
 * Rode com:  node --test scripts/checkoutMath.test.mjs
 *
 * Mantém em paridade com src/lib/checkoutMath.ts. Se você editar a lógica
 * lá, atualize aqui também (são funções puras, então é trivial).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

function round2(n) { return Math.round(n * 100) / 100; }

function normalizePrice(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  const c = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!c) return NaN;
  const n = Number(c);
  return Number.isFinite(n) ? n : NaN;
}
const isValidPrice = (v) => Number.isFinite(normalizePrice(v)) && normalizePrice(v) > 0;
const isValidStock = (v) => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0;
};

function calcCheckout({ items, shipping, insurance, coupon, paymentMethod }) {
  const subtotal = round2(items.reduce((s, it) => s + Math.max(0, it.price) * Math.max(0, it.quantity), 0));
  const shippingKnown = shipping != null;
  const ship = shippingKnown ? Math.max(0, Number(shipping)) : 0;
  const ins = insurance ? round2(subtotal * 0.10) : 0;
  let coup = 0;
  if (coupon && coupon.value > 0) {
    coup = coupon.type === "percent" ? round2(subtotal * coupon.value / 100) : Math.min(coupon.value, subtotal);
  }
  const beforePix = Math.max(0, subtotal + ship + ins - coup);
  const pix = paymentMethod === "pix" ? round2(beforePix * 0.05) : 0;
  return { subtotal, shipping: ship, shippingKnown, insurance: ins, couponDiscount: coup, pixDiscount: pix, total: round2(beforePix - pix) };
}

test("normalizePrice aceita vírgula/ponto", () => {
  assert.equal(normalizePrice("10,90"), 10.9);
  assert.equal(normalizePrice("10.90"), 10.9);
  assert.ok(Number.isNaN(normalizePrice("abc")));
});

test("isValidPrice rejeita zero/negativo", () => {
  assert.equal(isValidPrice("0"), false);
  assert.equal(isValidPrice("-1"), false);
  assert.equal(isValidPrice("5,50"), true);
});

test("isValidStock aceita 0, rejeita negativo", () => {
  assert.equal(isValidStock(0), true);
  assert.equal(isValidStock(-1), false);
  assert.equal(isValidStock("abc"), false);
});

test("frete não selecionado mantém shippingKnown false", () => {
  const r = calcCheckout({ items: [{ price: 100, quantity: 2 }], shipping: null, insurance: false, paymentMethod: "credit_card" });
  assert.equal(r.shippingKnown, false);
  assert.equal(r.total, 200);
});

test("PIX com cupom percentual", () => {
  const r = calcCheckout({ items: [{ price: 100, quantity: 2 }], shipping: 75, insurance: false, coupon: { type: "percent", value: 10 }, paymentMethod: "pix" });
  assert.equal(r.couponDiscount, 20);
  assert.equal(r.pixDiscount, 12.75);
  assert.equal(r.total, 242.25);
});

test("cupom fixo limitado ao subtotal", () => {
  const r = calcCheckout({ items: [{ price: 50, quantity: 1 }], shipping: 0, insurance: false, coupon: { type: "fixed", value: 999 }, paymentMethod: "credit_card" });
  assert.equal(r.couponDiscount, 50);
  assert.equal(r.total, 0);
});