// Supabase Edge Function (Deno)
// Gateway-ready endpoint used by Checkout.tsx after order creation.
// Expected envs (configure in Supabase project secrets):
// - PAYMENT_PROVIDER_BASE_URL
// - PAYMENT_PROVIDER_API_KEY

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
    .select("id, user_id, status")
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

  const providerBase = Deno.env.get("PAYMENT_PROVIDER_BASE_URL");
  const providerKey = Deno.env.get("PAYMENT_PROVIDER_API_KEY");

  if (!providerBase || !providerKey) {
    return new Response(JSON.stringify({ error: "provider_not_configured" }), {
      status: 501,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Replace this request with your provider-specific API contract.
  const upstream = await fetch(`${providerBase}/payment-intents`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${providerKey}`,
    },
    body: JSON.stringify({
      order_id: body.order_id,
      method: body.method,
    }),
  });

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: "provider_error", status: upstream.status }),
      {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  const data = await upstream.json();
  return new Response(
    JSON.stringify({
      checkout_url: data.checkout_url ?? null,
      provider_reference: data.reference ?? null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    },
  );
});
