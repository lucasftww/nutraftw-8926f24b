export class MockLoggiService {
  async quoteFreight(order) {
    const amount = Math.max(
      0,
      Math.floor(Number(order?.checkout?.freightCents) || 0)
    );
    return {
      provider: "mock-loggi",
      quotedCents: amount,
      etaDays: 5,
      serviceLevel: "standard",
      raw: { source: "mock", amount },
    };
  }

  async createShipment(order) {
    const externalId = String(order?.external_id || order?.externalId || "order");
    return {
      provider: "mock-loggi",
      shipmentId: `mock-ship-${externalId}`,
      trackingCode: `MOCK${Date.now()}`,
      status: "aguardando_coleta",
      raw: { source: "mock" },
    };
  }

  async trackShipment(trackingCode) {
    return {
      provider: "mock-loggi",
      trackingCode: String(trackingCode || ""),
      deliveryStatus: "em_transito",
      raw: { source: "mock" },
    };
  }
}

export function createLoggiService() {
  return new MockLoggiService();
}
