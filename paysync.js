/**
 * PaySync — https://usepaysync.com/documentacao
 * Base: https://api.usepaysync.com/api/v1 (override com PAYSYNC_API_BASE)
 */

export function paysyncApiBase() {
  return String(
    process.env.PAYSYNC_API_BASE || "https://api.usepaysync.com/api/v1"
  ).replace(/\/$/, "");
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${String(apiKey).trim()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Cobrança PIX avulsa (valor total em centavos).
 * @param {{
 *   apiKey: string;
 *   valueCents: number;
 *   description?: string;
 *   callbackUrl?: string;
 *   customer?: { name?: string; email?: string; externalId?: string };
 *   metadata?: string;
 * }} p
 */
export async function createPaySyncCharge(p) {
  const body = {
    valueCents: Math.max(100, Math.floor(Number(p.valueCents) || 0)),
    description: String(p.description || "Pagamento PIX").slice(0, 200),
  };
  if (p.callbackUrl) body.callbackUrl = String(p.callbackUrl).slice(0, 500);
  if (p.customer && (p.customer.name || p.customer.email || p.customer.externalId)) {
    body.customer = {};
    if (p.customer.name)
      body.customer.name = String(p.customer.name).slice(0, 100);
    if (p.customer.email)
      body.customer.email = String(p.customer.email).slice(0, 255);
    if (p.customer.externalId)
      body.customer.externalId = String(p.customer.externalId).slice(0, 200);
  }
  if (p.metadata) body.metadata = String(p.metadata).slice(0, 2048);

  const res = await fetch(`${paysyncApiBase()}/charges`, {
    method: "POST",
    headers: authHeaders(p.apiKey),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json.error ||
      json.message ||
      (typeof json === "string" ? json : null) ||
      `PaySync HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * @param {{ apiKey: string; paymentId: string }} p
 */
export async function getPaySyncCharge(p) {
  const id = encodeURIComponent(String(p.paymentId || "").trim());
  const res = await fetch(`${paysyncApiBase()}/charges/${id}`, {
    method: "GET",
    headers: authHeaders(p.apiKey),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json.error ||
      json.message ||
      `PaySync HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
