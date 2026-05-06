import { describe, expect, it } from "vitest";
import { calcTotals } from "@/lib/checkoutMath";

describe("calcTotals", () => {
  it("calcula subtotal com cupom percentual e desconto pix", () => {
    const totals = calcTotals({
      subtotal: 1000,
      shipping: 50,
      insurance: true,
      coupon: { type: "percent", value: 10 },
      paymentMethod: "pix",
    });

    expect(totals.insurance).toBe(100);
    expect(totals.couponDiscount).toBe(100);
    expect(totals.pixDiscount).toBe(52.5);
    expect(totals.total).toBe(997.5);
  });

  it("limita cupom fixo ao subtotal", () => {
    const totals = calcTotals({
      subtotal: 120,
      shipping: 0,
      insurance: false,
      coupon: { type: "fixed", value: 500 },
      paymentMethod: "credit_card",
    });

    expect(totals.couponDiscount).toBe(120);
    expect(totals.total).toBe(0);
  });

  it("marca frete desconhecido quando shipping é null", () => {
    const totals = calcTotals({
      subtotal: 200,
      shipping: null,
      insurance: false,
      coupon: null,
      paymentMethod: "credit_card",
    });

    expect(totals.shippingKnown).toBe(false);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(200);
  });
});
