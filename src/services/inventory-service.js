import {
  addStockMovement,
  getStockSetting,
  listLowStockProducts,
  listProductSupplierLinks,
  listStockMovements,
  setStockSetting,
} from "../../db.js";

export function lowStockThresholdDefault() {
  return Math.max(0, Math.floor(Number(getStockSetting("default_low_stock_threshold", "5")) || 5));
}

export function setLowStockThresholdDefault(v) {
  const n = Math.max(0, Math.floor(Number(v) || 0));
  setStockSetting("default_low_stock_threshold", String(n));
  return n;
}

export function getInventoryAlerts() {
  const th = lowStockThresholdDefault();
  const products = listLowStockProducts(th);
  return { thresholdDefault: th, products };
}

export function getStockMovements(params = {}) {
  return listStockMovements(params);
}

export function adjustInventory({
  productId,
  qtyDelta,
  reason = "",
  referenceType = "",
  referenceId = "",
  actorEmail = "",
}) {
  return addStockMovement({
    productId,
    movementType: qtyDelta > 0 ? "ENTRADA" : "SAIDA",
    qtyDelta,
    reason,
    referenceType,
    referenceId,
    actorEmail,
  });
}

export function primarySupplierForProduct(productId) {
  const links = listProductSupplierLinks(productId);
  if (!links.length) return null;
  return links.find((x) => Number(x.is_primary) === 1) || links[0];
}
