// Webhook público da MisticPay. Recebe notificações de status de transações
// (DEPOSITO/RETIRADA) e atualiza o pedido correspondente.
//
// URL pública (configure no painel MisticPay):
//   https://idutmqfqnoozqbjeqtui.supabase.co/functions/v1/misticpay-webhook
//
// Esta função é PÚBLICA (verify_jwt = false) — a MisticPay chama sem JWT.
// A correlação é feita por payment_reference (transactionId do provedor).
//
// === SEGURANÇA: VERIFY-BY-CALLBACK ===
// A MisticPay não documenta assinatura HMAC nos webhooks. Em vez de confiar
// no payload (que qualquer um pode forjar), consultamos o estado real da
// transação via `POST /api/transactions/check`, autenticado com nossas
// credenciais `ci`/`cs`. A resposta dessa chamada é a fonte da verdade —
// o `status` no webhook é só um sinal "algo mudou, vai conferir".
//
// Defesa em profundidade adicional: se `MISTICPAY_WEBHOOK_SECRET` estiver
// configurado, também exigimos assinatura HMAC-SHA256 do corpo bruto no
// header `x-misticpay-signature`. Hoje a MisticPay não envia esse header,
// então o secret fica intencionalmente NÃO configurado.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-misticpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Comparação em tempo constante para evitar timing oracles.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  // Lê o corpo bruto antes de parsear — assinatura é calculada sobre os
  // bytes exatos enviados pelo provedor.
  const rawBody = await req.text();

  const webhookSecret = Deno.env.get("MISTICPAY_WEBHOOK_SECRET");
  if (webhookSecret) {
    const provided = (req.headers.get("x-misticpay-signature") || "").trim().toLowerCase();
    if (!provided) {
      console.warn("[misticpay-webhook] missing signature header");
      return new Response(JSON.stringify({ error: "missing_signature" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const expected = await hmacSha256Hex(webhookSecret, rawBody);
    // Aceita formatos `sha256=<hex>` ou `<hex>` puro.
    const candidate = provided.startsWith("sha256=") ? provided.slice(7) : provided;
    if (!timingSafeEqualHex(candidate, expected)) {
      console.warn("[misticpay-webhook] invalid signature");
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  } else {
    console.warn("[misticpay-webhook] MISTICPAY_WEBHOOK_SECRET not set — accepting unsigned webhook (configure in production)");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  console.log("[misticpay-webhook] received", JSON.stringify(payload));

  // Webhooks de infração (MED) — apenas registramos por enquanto.
  if (payload?.event === "INFRACTION") {
    return new Response(JSON.stringify({ ok: true, kind: "infraction" }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const providerRef = payload?.transactionId ? String(payload.transactionId) : "";
  // status do webhook NÃO é fonte da verdade — só usamos pra logging.
  const claimedStatus = String(payload?.status ?? "").toUpperCase();
  const txType = String(payload?.transactionType ?? "").toUpperCase();

  if (!providerRef) {
    return new Response(JSON.stringify({ error: "missing_transactionId" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: order, error: lookupErr } = await admin
    .from("orders")
    .select("id, status, user_id")
    .eq("payment_reference", providerRef)
    .maybeSingle();

  if (lookupErr) {
    console.error("[misticpay-webhook] lookup error", lookupErr);
    return new Response(JSON.stringify({ error: "lookup_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!order) {
    // 200 para a MisticPay não reentregar indefinidamente.
    console.warn("[misticpay-webhook] no order for ref", providerRef);
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Defesa em profundidade: pedido sem user_id é estado corrompido — não
  // atualizamos para evitar marcar pedido órfão como pago.
  if (!order.user_id) {
    console.error("[misticpay-webhook] order without user_id", order.id);
    return new Response(JSON.stringify({ error: "invalid_order_state" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Mapeia status MisticPay -> order_status local. Só atualizamos depósitos.
  if (txType && txType !== "DEPOSITO") {
    return new Response(JSON.stringify({ ok: true, ignored: txType }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // === VERIFY-BY-CALLBACK ===
  // Em vez de confiar em payload.status (forjável), consultamos o estado real
  // da transação na MisticPay com nossas credenciais. A resposta é fonte da
  // verdade. Se a chamada falhar, retornamos 5xx para que a MisticPay re-entregue.
  const ci = Deno.env.get("MISTICPAY_CLIENT_ID");
  const cs = Deno.env.get("MISTICPAY_CLIENT_SECRET");
  if (!ci || !cs) {
    console.error("[misticpay-webhook] MISTICPAY credentials not configured");
    return new Response(JSON.stringify({ error: "provider_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let verifiedState = "";
  try {
    const checkResp = await fetch("https://api.misticpay.com/api/transactions/check", {
      method: "POST",
      headers: { "content-type": "application/json", ci, cs },
      body: JSON.stringify({ transactionId: providerRef }),
    });
    const checkText = await checkResp.text();
    if (!checkResp.ok) {
      // Sanitiza: nunca ecoamos response do provedor pra logs (pode conter dados sensíveis).
      console.error("[misticpay-webhook] check failed", checkResp.status);
      return new Response(JSON.stringify({ error: "verification_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    let checkJson: any = null;
    try { checkJson = JSON.parse(checkText); } catch { /* keep null */ }
    // O endpoint /transactions/check responde com { transactionId, transactionState, value, fee }.
    // Aceita também resposta envelopada em `data` (idioma comum em REST).
    const tx = checkJson?.data ?? checkJson;
    verifiedState = String(tx?.transactionState ?? tx?.status ?? "").toUpperCase();
    if (!verifiedState) {
      console.error("[misticpay-webhook] check returned no state", { providerRef });
      return new Response(JSON.stringify({ error: "verification_inconclusive" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[misticpay-webhook] check network error", String(err));
    return new Response(JSON.stringify({ error: "verification_unreachable" }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (claimedStatus && claimedStatus !== verifiedState) {
    // Webhook mentiu (ou está atrasado) — log de auditoria. Confiamos no verified.
    console.warn("[misticpay-webhook] claim/verified mismatch", {
      claimed: claimedStatus,
      verified: verifiedState,
      providerRef,
    });
  }

  const update: Record<string, unknown> = {};
  if (verifiedState === "COMPLETO") {
    update.status = "paid";
    update.paid_at = new Date().toISOString();
  } else if (verifiedState === "FALHA" || verifiedState === "CANCELADO") {
    update.status = "cancelled";
  } else {
    // PENDENTE / outro estado intermediário — nada a fazer.
    return new Response(JSON.stringify({ ok: true, verified: verifiedState }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { error: updErr } = await admin.from("orders").update(update).eq("id", order.id);
  if (updErr) {
    console.error("[misticpay-webhook] update error", updErr);
    return new Response(JSON.stringify({ error: "update_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, order_id: order.id, new_status: update.status, verified: verifiedState }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});