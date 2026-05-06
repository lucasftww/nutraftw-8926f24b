/**
 * Testes unitários puros — projetados para rodar com `bunx vitest` ou
 * `node --test` (basta que o ambiente tenha `describe/it/expect` ou
 * `node:test`). Como o projeto ainda não tem vitest instalado nas deps,
 * esses testes ficam prontos para serem executados quando o setup de
 * testes for adicionado (ver instruções no topo do README desta pasta).
 */
import { describe, it, expect } from "vitest";
import {
  calcCheckout,
  normalizePrice,
  isValidPrice,
  isValidStock,
  applyStatusChange,
} from "../checkoutMath";

describe("normalizePrice", () => {
  it("aceita vírgula e ponto", () => {
    expect(normalizePrice("10,90")).toBe(10.9);
    expect(normalizePrice("10.90")).toBe(10.9);
    expect(normalizePrice(15)).toBe(15);
  });
  it("rejeita inválidos", () => {
    expect(Number.isNaN(normalizePrice(""))).toBe(true);
    expect(Number.isNaN(normalizePrice("abc"))).toBe(true);
  });
});

describe("isValidPrice / isValidStock", () => {
  it("rejeita preço zero ou negativo", () => {
    expect(isValidPrice("0")).toBe(false);
    expect(isValidPrice("-5")).toBe(false);
    expect(isValidPrice("5,50")).toBe(true);
  });
  it("aceita estoque zero, rejeita negativo", () => {
    expect(isValidStock(0)).toBe(true);
    expect(isValidStock("0")).toBe(true);
    expect(isValidStock(-1)).toBe(false);
    expect(isValidStock("abc")).toBe(false);
  });
});

describe("calcCheckout", () => {
  const items = [{ price: 100, quantity: 2 }];
  it("frete não selecionado → shippingKnown false e total sem frete", () => {
    const r = calcCheckout({ items, shipping: null, insurance: false, paymentMethod: "credit_card" });
    expect(r.subtotal).toBe(200);
    expect(r.shippingKnown).toBe(false);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(200);
  });
  it("frete + seguro 10% + cartão", () => {
    const r = calcCheckout({ items, shipping: 75, insurance: true, paymentMethod: "credit_card" });
    // 200 + 75 + 20 = 295
    expect(r.insurance).toBe(20);
    expect(r.total).toBe(295);
    expect(r.pixDiscount).toBe(0);
  });
  it("PIX aplica 5% sobre subtotal+frete+seguro−cupom", () => {
    const r = calcCheckout({
      items, shipping: 75, insurance: false,
      coupon: { type: "percent", value: 10 }, paymentMethod: "pix",
    });
    // 200 + 75 = 275; cupom 10% = 20 → 255; PIX 5% = 12.75 → 242.25
    expect(r.couponDiscount).toBe(20);
    expect(r.pixDiscount).toBe(12.75);
    expect(r.total).toBe(242.25);
  });
  it("cupom fixo nunca passa do subtotal", () => {
    const r = calcCheckout({
      items: [{ price: 50, quantity: 1 }], shipping: 0, insurance: false,
      coupon: { type: "fixed", value: 999 }, paymentMethod: "credit_card",
    });
    expect(r.couponDiscount).toBe(50);
    expect(r.total).toBe(0);
  });
});

describe("applyStatusChange", () => {
  type O = { id: string; status: string };
  it("ignora se status igual", async () => {
    const list: O[] = [{ id: "a", status: "paid" }];
    let next: O[] | null = null;
    const r = await applyStatusChange(list, "a", "paid", (n) => (next = n), async () => ({ error: null }));
    expect(r.changed).toBe(false);
    expect(next).toBe(null);
  });
  it("aplica otimista e mantém em sucesso", async () => {
    const list: O[] = [{ id: "a", status: "pending" }];
    let cur = list;
    const r = await applyStatusChange(list, "a", "paid", (n) => (cur = n), async () => ({ error: null }));
    expect(r.ok).toBe(true);
    expect(cur[0].status).toBe("paid");
  });
  it("faz rollback em erro", async () => {
    const list: O[] = [{ id: "a", status: "pending" }];
    let cur = list;
    const r = await applyStatusChange(list, "a", "paid", (n) => (cur = n), async () => ({ error: new Error("boom") }));
    expect(r.ok).toBe(false);
    expect(cur[0].status).toBe("pending");
  });
});