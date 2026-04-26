const API_BASE = "https://api.misticpay.com/api";

/**
 * @param {object} p
 * @param {string} p.ci
 * @param {string} p.cs
 * @param {number} p.amountReais valor em reais (ex.: 12.34)
 * @param {string} p.payerName
 * @param {string} p.payerDocument CPF só dígitos
 * @param {string} p.transactionId id único da sua loja
 * @param {string} p.description
 * @param {string} [p.projectWebhook]
 */
export async function createPixTransaction(p) {
  const body = {
    amount: p.amountReais,
    payerName: p.payerName,
    payerDocument: p.payerDocument,
    transactionId: p.transactionId,
    description: p.description,
  };
  if (p.projectWebhook) body.projectWebhook = p.projectWebhook;

  const res = await fetch(`${API_BASE}/transactions/create`, {
    method: "POST",
    headers: {
      ci: p.ci,
      cs: p.cs,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      (typeof json === "string" ? json : null) ||
      `MisticPay HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * @param {{ ci: string; cs: string; transactionId: string | number }} p
 */
export async function checkTransaction(p) {
  const res = await fetch(`${API_BASE}/transactions/check`, {
    method: "POST",
    headers: {
      ci: p.ci,
      cs: p.cs,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transactionId: p.transactionId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      `MisticPay HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
