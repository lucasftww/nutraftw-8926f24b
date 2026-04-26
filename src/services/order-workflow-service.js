import {
  addOrderTimelineEvent,
  createSupplierOrder,
  getPixOrderByExternalId,
  getProductBySlug,
  listSupplierOrdersByExternalOrder,
  updatePixOrderStatus,
} from "../../db.js";
import { adjustInventory, primarySupplierForProduct } from "./inventory-service.js";

function parseLines(order) {
  try {
    return JSON.parse(String(order?.lines_json || "[]"));
  } catch {
    return [];
  }
}

export function appendOrderTimeline(externalOrderId, eventKey, title, detail = "", payload = {}) {
  addOrderTimelineEvent({
    externalOrderId,
    eventKey,
    title,
    detail,
    payloadJson: JSON.stringify(payload || {}),
  });
}

export function transitionOrderStatus(externalOrderId, status, detail = "", payload = {}) {
  updatePixOrderStatus(externalOrderId, status);
  appendOrderTimeline(
    externalOrderId,
    `order.${String(status || "").toLowerCase()}`,
    `Estado atualizado para ${status}`,
    detail,
    payload
  );
}

export function processOrderAfterPayment(externalOrderId, actorEmail = "system") {
  const order = getPixOrderByExternalId(externalOrderId);
  if (!order) return null;
  const lines = parseLines(order);
  let hasSupplierFlow = false;
  for (const line of lines) {
    const slug = String(line?.slug || "").trim();
    const qty = Math.max(0, Math.floor(Number(line?.qty) || 0));
    if (!slug || qty < 1) continue;
    const p = getProductBySlug(slug);
    if (!p) continue;
    const mode = String(p.inventory_mode || "local").toLowerCase();
    if (mode !== "dropshipping") {
      adjustInventory({
        productId: p.id,
        qtyDelta: -qty,
        reason: "Baixa automática por pagamento confirmado",
        referenceType: "ORDER",
        referenceId: externalOrderId,
        actorEmail,
      });
    }
    if (mode === "dropshipping" || mode === "hybrid") {
      const link = primarySupplierForProduct(p.id);
      if (link) {
        hasSupplierFlow = true;
        const totalCost = Math.max(0, Number(link.supplier_cost_cents) || 0) * qty;
        createSupplierOrder({
          externalOrderId,
          supplierId: link.supplier_id,
          status: "AGUARDANDO_FORNECEDOR",
          totalCostCents: totalCost,
          payloadJson: JSON.stringify({
            productId: p.id,
            productName: p.name,
            qty,
            supplierSku: link.supplier_sku || "",
          }),
        });
      }
    }
  }
  if (hasSupplierFlow) {
    transitionOrderStatus(
      externalOrderId,
      "AGUARDANDO_FORNECEDOR",
      "Pedido aguardando confirmação do fornecedor."
    );
  } else {
    transitionOrderStatus(
      externalOrderId,
      "PREPARANDO_ENVIO",
      "Pedido pago e em separação para envio."
    );
  }
  return {
    supplierOrders: listSupplierOrdersByExternalOrder(externalOrderId),
  };
}
