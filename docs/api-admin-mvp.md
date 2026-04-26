# Admin API MVP

## Inventory

- `GET /api/admin/inventory/alerts`
- `GET /api/admin/inventory/movements?limit=25&offset=0&productId=1`
- `POST /api/admin/inventory/adjust`
  - body: `{ "productId": 1, "qtyDelta": -2, "reason": "Ajuste" }`
- `PUT /api/admin/inventory/settings/low-stock-threshold`
  - body: `{ "threshold": 5 }`

## Suppliers

- `GET /api/admin/suppliers`
- `POST /api/admin/suppliers`
  - body: `{ "name": "Fornecedor A", "contact_email": "a@x.com", "lead_time_days": 7 }`
- `PUT /api/admin/suppliers/:id`
- `PUT /api/admin/products/:productId/suppliers`
  - body: `{ "supplier_id": 1, "supplier_cost_cents": 1200, "supplier_eta_days": 9, "is_primary": true }`

## Orders / Timeline

- `GET /api/admin/orders/:externalId/timeline`
- `POST /api/admin/orders/:externalId/supplier-order`
- `PUT /api/admin/supplier-orders/:id/status`

## Analytics

- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/sales-series?days=30`
- `GET /api/admin/analytics/visits-series?days=30`
- `GET /api/admin/analytics/realtime-users?limit=25`
