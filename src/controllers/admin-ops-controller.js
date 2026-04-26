import {
  addOrderTimelineEvent,
  createSupplier,
  createSupplierOrder,
  getSupplierOrderById,
  getPixOrderByExternalId,
  listOrderTimelineEvents,
  listSuppliers,
  listSupplierOrdersByExternalOrder,
  upsertProductSupplierLink,
  updateSupplier,
  updateSupplierOrderStatus,
  getSupplierById,
} from "../../db.js";
import {
  adjustInventory,
  getInventoryAlerts,
  getStockMovements,
  setLowStockThresholdDefault,
} from "../services/inventory-service.js";
import {
  analyticsOverview,
  realtimeUsers,
  salesSeries,
  visitsSeries,
} from "../services/analytics-service.js";

function safeMessage(e, fallback) {
  return e instanceof Error ? e.message : fallback;
}

export function getInventoryAlertsController(_req, res) {
  try {
    res.json(getInventoryAlerts());
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar alertas de stock") });
  }
}

export function getInventoryMovementsController(req, res) {
  try {
    const limit = Number(req.query.limit);
    const offset = Number(req.query.offset);
    const productId = req.query.productId != null ? Number(req.query.productId) : null;
    const rows = getStockMovements({ limit, offset, productId });
    res.json({ movements: rows });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar movimentos") });
  }
}

export function adjustInventoryController(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = adjustInventory({
      productId: body.productId,
      qtyDelta: body.qtyDelta,
      reason: body.reason || "Ajuste manual",
      referenceType: "ADMIN",
      referenceId: body.referenceId || "",
      actorEmail: String(req.session?.email || ""),
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao ajustar stock") });
  }
}

export function setDefaultLowStockController(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const value = setLowStockThresholdDefault(body.threshold);
    res.json({ ok: true, thresholdDefault: value });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao atualizar threshold") });
  }
}

export function listSuppliersController(_req, res) {
  try {
    res.json({ suppliers: listSuppliers() });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao listar fornecedores") });
  }
}

export function createSupplierController(req, res) {
  try {
    const supplier = createSupplier(req.body || {});
    res.status(201).json({ supplier });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao criar fornecedor") });
  }
}

export function updateSupplierController(req, res) {
  try {
    const id = Math.floor(Number(req.params.id));
    const row = updateSupplier(id, req.body || {});
    if (!row) return res.status(404).json({ error: "Fornecedor não encontrado" });
    res.json({ supplier: row });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao atualizar fornecedor") });
  }
}

export function upsertProductSupplierLinkController(req, res) {
  try {
    const productId = Math.floor(Number(req.params.productId));
    const links = upsertProductSupplierLink(productId, req.body || {});
    res.json({ links });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao vincular fornecedor") });
  }
}

export function getOrderTimelineController(req, res) {
  try {
    const externalId = String(req.params.externalId || "").trim();
    const order = getPixOrderByExternalId(externalId);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    const events = listOrderTimelineEvents(externalId);
    const supplierOrders = listSupplierOrdersByExternalOrder(externalId);
    res.json({ events, supplierOrders });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar timeline") });
  }
}

export function createSupplierOrderController(req, res) {
  try {
    const externalId = String(req.params.externalId || "").trim();
    const order = getPixOrderByExternalId(externalId);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    const supplierId = Math.floor(Number(req.body?.supplierId));
    const supplier = getSupplierById(supplierId);
    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado" });
    createSupplierOrder({
      externalOrderId: externalId,
      supplierId,
      status: "AGUARDANDO_FORNECEDOR",
      totalCostCents: Math.max(0, Math.floor(Number(req.body?.totalCostCents) || 0)),
      payloadJson: JSON.stringify(req.body?.payload || {}),
    });
    const rows = listSupplierOrdersByExternalOrder(externalId);
    res.json({ ok: true, supplierOrders: rows });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao gerar pedido fornecedor") });
  }
}

export function updateSupplierOrderStatusController(req, res) {
  try {
    const id = Math.floor(Number(req.params.id));
    const before = getSupplierOrderById(id);
    if (!before) return res.status(404).json({ error: "Pedido fornecedor não encontrado" });
    const nextStatus = String(req.body?.status || "").trim().toUpperCase();
    updateSupplierOrderStatus(id, nextStatus, req.body?.trackingCode || "");
    if (nextStatus) {
      if (nextStatus === "ENVIADO_PELO_FORNECEDOR") {
        addOrderTimelineEvent({
          externalOrderId: before.external_order_id,
          eventKey: "supplier.sent",
          title: "Enviado pelo fornecedor",
          detail: "Fornecedor informou o envio do pedido.",
          payloadJson: JSON.stringify({ supplierOrderId: id }),
        });
      } else if (nextStatus === "ENTREGUE") {
        addOrderTimelineEvent({
          externalOrderId: before.external_order_id,
          eventKey: "order.delivered",
          title: "Pedido entregue",
          detail: "Confirmação de entrega recebida.",
          payloadJson: JSON.stringify({ supplierOrderId: id }),
        });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: safeMessage(e, "Erro ao atualizar supplier order") });
  }
}

export function analyticsOverviewController(_req, res) {
  try {
    res.json(analyticsOverview());
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar analytics") });
  }
}

export function analyticsSalesSeriesController(req, res) {
  try {
    const days = Number(req.query.days);
    res.json({ series: salesSeries(days) });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar série") });
  }
}

export function analyticsVisitsSeriesController(req, res) {
  try {
    const days = Number(req.query.days);
    res.json({ series: visitsSeries(days) });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar acessos") });
  }
}

export function analyticsRealtimeController(req, res) {
  try {
    const limit = Number(req.query.limit);
    res.json({ users: realtimeUsers(limit) });
  } catch (e) {
    res.status(500).json({ error: safeMessage(e, "Erro ao carregar realtime") });
  }
}
