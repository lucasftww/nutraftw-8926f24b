// Supabase Edge Function (Deno)
// Gateway-ready endpoint used by Checkout.tsx after order creation.
// Expected envs (configure in Supabase project secrets):
// - PAYMENT_PROVIDER_BASE_URL
// - PAYMENT_PROVIDER_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Payload = {
  order_id?: string;
  method?: "pix" | "credit_card";
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.order_id || !body.method) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const providerBase = Deno.env.get("PAYMENT_PROVIDER_BASE_URL");
  const providerKey = Deno.env.get("PAYMENT_PROVIDER_API_KEY");

  if (!providerBase || !providerKey) {
    return new Response(JSON.stringify({ error: "provider_not_configured" }), {
      status: 501,
      headers: { "content-type": "application/json" },
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
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return new Response(
    JSON.stringify({
      checkout_url: data.checkout_url ?? null,
      provider_reference: data.reference ?? null,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
