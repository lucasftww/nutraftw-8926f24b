// Webhook público da MisticPay. Recebe notificações de status de transações
// (DEPOSITO/RETIRADA) e atualiza o pedido correspondente.
//
// URL pública (configure no painel MisticPay):
//   https://idutmqfqnoozqbjeqtui.supabase.co/functions/v1/misticpay-webhook
//
// Esta função é PÚBLICA (verify_jwt = false) — a MisticPay chama sem JWT.
// A correlação é feita por payment_reference (transactionId do provedor).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = await req.json();
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
  const status = String(payload?.status ?? "").toUpperCase();
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
    .select("id, status")
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

  // Mapeia status MisticPay -> order_status local. Só atualizamos depósitos.
  if (txType && txType !== "DEPOSITO") {
    return new Response(JSON.stringify({ ok: true, ignored: txType }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const update: Record<string, unknown> = {};
  if (status === "COMPLETO") {
    update.status = "paid";
    update.paid_at = new Date().toISOString();
  } else if (status === "FALHA" || status === "CANCELADO") {
    update.status = "cancelled";
  } else {
    // PENDENTE — nada a fazer.
    return new Response(JSON.stringify({ ok: true, status }), {
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

  return new Response(JSON.stringify({ ok: true, order_id: order.id, new_status: update.status }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});