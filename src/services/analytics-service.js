import {
  adminCatalogCounts,
  listPixOrders,
  pixOrdersStatusCounts,
  countPixOrders,
  listOnlineSessions,
  visitCountsPerDay,
} from "../../db.js";
import { getInventoryAlerts } from "./inventory-service.js";

function parseCreatedAt(v) {
  const d = new Date(String(v || "").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function analyticsOverview() {
  const rows = listPixOrders({ limit: 50000, offset: 0, status: null });
  let totalRevenueCents = 0;
  let paidCount = 0;
  for (const r of rows) {
    const st = String(r.status || "").toUpperCase();
    if (st === "COMPLETO" || st === "PAGO" || st === "PREPARANDO_ENVIO" || st === "ENVIADO" || st === "ENTREGUE") {
      totalRevenueCents += Number(r.amount_cents || 0);
      paidCount += 1;
    }
  }
  const ticketMedioCents = paidCount > 0 ? Math.round(totalRevenueCents / paidCount) : 0;
  const alerts = getInventoryAlerts();
  return {
    catalog: adminCatalogCounts(),
    ordersByStatus: pixOrdersStatusCounts().map((r) => ({ status: r.status, count: Number(r.n || 0) })),
    ordersTotal: countPixOrders(),
    paidCount,
    totalRevenueCents,
    ticketMedioCents,
    lowStockCount: alerts.products.length,
  };
}

export function salesSeries(days = 30) {
  const n = Math.min(365, Math.max(1, Math.floor(Number(days) || 30)));
  const rows = listPixOrders({ limit: 50000, offset: 0, status: null });
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (n - 1));
  start.setHours(0, 0, 0, 0);
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, orders: 0, revenueCents: 0 });
  }
  for (const r of rows) {
    const dt = parseCreatedAt(r.created_at);
    if (!dt || dt < start) continue;
    const key = dt.toISOString().slice(0, 10);
    if (!map.has(key)) continue;
    const cell = map.get(key);
    cell.orders += 1;
    const st = String(r.status || "").toUpperCase();
    if (st === "COMPLETO" || st === "PAGO" || st === "PREPARANDO_ENVIO" || st === "ENVIADO" || st === "ENTREGUE") {
      cell.revenueCents += Number(r.amount_cents || 0);
    }
  }
  return [...map.values()];
}

export function visitsSeries(days = 30) {
  const rows = visitCountsPerDay(days);
  return rows.map((r) => ({ date: String(r.day || ""), visits: Number(r.visits || 0) }));
}

export function realtimeUsers(limit = 100) {
  const rows = listOnlineSessions(limit);
  return rows.map((x) => ({
    sessionId: x.session_id,
    path: x.path,
    ip: x.ip,
    userAgent: x.user_agent,
    lastSeenAt: x.last_seen_at,
  }));
}
