import { Router } from "express";
import {
  adjustInventoryController,
  analyticsOverviewController,
  analyticsRealtimeController,
  analyticsSalesSeriesController,
  analyticsVisitsSeriesController,
  createSupplierController,
  createSupplierOrderController,
  getInventoryAlertsController,
  getInventoryMovementsController,
  getOrderTimelineController,
  listSuppliersController,
  setDefaultLowStockController,
  updateSupplierController,
  updateSupplierOrderStatusController,
  upsertProductSupplierLinkController,
} from "../controllers/admin-ops-controller.js";

export function registerAdminOpsRoutes(app, requireAdmin) {
  const r = Router();
  r.get("/inventory/alerts", getInventoryAlertsController);
  r.get("/inventory/movements", getInventoryMovementsController);
  r.post("/inventory/adjust", adjustInventoryController);
  r.put("/inventory/settings/low-stock-threshold", setDefaultLowStockController);

  r.get("/suppliers", listSuppliersController);
  r.post("/suppliers", createSupplierController);
  r.put("/suppliers/:id", updateSupplierController);
  r.put("/products/:productId/suppliers", upsertProductSupplierLinkController);

  r.get("/orders/:externalId/timeline", getOrderTimelineController);
  r.post("/orders/:externalId/supplier-order", createSupplierOrderController);
  r.put("/supplier-orders/:id/status", updateSupplierOrderStatusController);

  r.get("/analytics/overview", analyticsOverviewController);
  r.get("/analytics/sales-series", analyticsSalesSeriesController);
  r.get("/analytics/visits-series", analyticsVisitsSeriesController);
  r.get("/analytics/realtime-users", analyticsRealtimeController);

  app.use("/api/admin", requireAdmin, r);
}
