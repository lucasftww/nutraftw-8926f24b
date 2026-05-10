// Supabase Edge Function (Deno)
// Cria a transação PIX na MisticPay (cash-in) para um pedido já gravado.
// Envs obrigatórias (Project Secrets):
// - MISTICPAY_CLIENT_ID
// - MISTICPAY_CLIENT_SECRET

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Payload = {
  order_id?: string;
  method?: "pix" | "credit_card";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // ===== AuthN: require a valid Supabase JWT =====
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (
    !body.order_id ||
    !body.method ||
    !UUID_RE.test(body.order_id) ||
    (body.method !== "pix" && body.method !== "credit_card")
  ) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // ===== AuthZ: verify the order belongs to the caller =====
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: order, error: orderErr } = await adminClient
    .from("orders")
    .select("id, user_id, status, total, shipping_full_name, shipping_cpf, payment_reference, payment_qr_code, payment_copy_paste")
    .eq("id", body.order_id)
    .maybeSingle();
  if (orderErr) {
    return new Response(JSON.stringify({ error: "lookup_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  if (!order || order.user_id !== userId) {
    // Same response for not-found and not-owned to avoid an existence oracle.
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Cartão ainda não suportado pela MisticPay (apenas PIX).
  if (body.method !== "pix") {
    return new Response(
      JSON.stringify({ error: "method_not_supported", method: body.method }),
      {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  // Idempotência: se já existe QR para este pedido, devolve sem chamar de novo.
  if (order.payment_qr_code && order.payment_copy_paste) {
    return new Response(
      JSON.stringify({
        provider: "misticpay",
        method: "pix",
        provider_reference: order.payment_reference,
        qr_code_base64: order.payment_qr_code,
        copy_paste: order.payment_copy_paste,
        amount: Number(order.total),
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const ci = Deno.env.get("MISTICPAY_CLIENT_ID");
  const cs = Deno.env.get("MISTICPAY_CLIENT_SECRET");
  if (!ci || !cs) {
    return new Response(JSON.stringify({ error: "provider_not_configured" }), {
      status: 501,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const cpfDigits = String(order.shipping_cpf ?? "").replace(/\D/g, "");
  const payerName = String(order.shipping_full_name ?? "Cliente").slice(0, 80);
  const amount = Number(order.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: "invalid_order_amount" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  if (cpfDigits.length !== 11) {
    return new Response(JSON.stringify({ error: "invalid_cpf" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/misticpay-webhook`;

  // Headers de autenticação isolados em escopo local — evita que loggers ou
  // serializadores futuros incluam o objeto inteiro com credenciais.
  const authHeaders: Record<string, string> = {
    "content-type": "application/json",
    ci,
    cs,
  };
  const upstream = await fetch("https://api.misticpay.com/api/transactions/create", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      amount,
      payerName,
      payerDocument: cpfDigits,
      transactionId: order.id,
      description: `Pedido Royal Vitta ${String(order.id).slice(0, 8)}`,
      projectWebhook: webhookUrl,
    }),
  });

  const upstreamText = await upstream.text();
  let upstreamJson: any = null;
  try { upstreamJson = JSON.parse(upstreamText); } catch { /* keep null */ }

  if (!upstream.ok || !upstreamJson?.data) {
    // Nunca logar `authHeaders`. Em produção, se o provider ecoasse credenciais
    // no body de erro, este log iria pro Supabase Functions logs — sanitizamos.
    const safeDetails = upstreamJson?.message
      ? { message: String(upstreamJson.message) }
      : { message: "provider_unavailable" };
    console.error("[misticpay] create failed", upstream.status, safeDetails);
    return new Response(
      JSON.stringify({ error: "provider_error", status: upstream.status, details: safeDetails }),
      { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const tx = upstreamJson.data;
  const providerRef = String(tx.transactionId ?? "");
  const qrBase64 = String(tx.qrCodeBase64 ?? "");
  const copyPaste = String(tx.copyPaste ?? "");

  // Persiste no pedido para idempotência e exibição posterior.
  await adminClient
    .from("orders")
    .update({
      payment_provider: "misticpay",
      payment_reference: providerRef,
      payment_qr_code: qrBase64,
      payment_copy_paste: copyPaste,
    })
    .eq("id", order.id);

  return new Response(
    JSON.stringify({
      provider: "misticpay",
      method: "pix",
      provider_reference: providerRef,
      qr_code_base64: qrBase64,
      copy_paste: copyPaste,
      amount,
    }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
