import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, captureError, writeAuditLog } from "../_shared/observability.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";
import { loadPaymobConfig, paymobAuthenticate, paymobCreateOrder, paymobPaymentKey, buildPaymobIframeUrl } from "../_shared/paymob.ts";
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from "../_shared/supabase.ts";

type Body = {
  workspace_id: string;
  requested_tier: "paid1" | "paid2" | "paid3";
  amount_egp: number; // billed amount
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  };
};

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabaseUrl = env("SUPABASE_URL");
  const admin = getSupabaseAdmin();
  const userId = await getAuthUserId(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, { status: 401 });
  const isMember = await assertWorkspaceMember({ supabase: admin, workspaceId: body.workspace_id, userId });
  if (!isMember) return jsonResponse({ error: "forbidden" }, { status: 403 });

  // Rate limit by workspace + user
  const rl = await enforceRateLimit({
    key: `paymob_create:${body.workspace_id}:${userId}`,
    windowSeconds: 60,
    max: 10,
  });
  if (!rl.allowed) {
    return jsonResponse({ error: "rate_limited", resetAt: rl.resetAt }, { status: 429 });
  }

  // reuse admin client

  try {
    const cfg = loadPaymobConfig();
    const authToken = await paymobAuthenticate(cfg.apiKey);

    const amountCents = Math.round((body.amount_egp ?? 0) * 100);
    if (amountCents <= 0) return jsonResponse({ error: "Invalid amount" }, { status: 400 });

    // Create invoice record first
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        workspace_id: body.workspace_id,
        amount_egp: body.amount_egp,
        currency: "EGP",
        status: "pending",
        metadata: {
          requested_tier: body.requested_tier,
          customer: body.customer,
        },
      })
      .select("*")
      .single();
    if (invErr) throw invErr;

    const merchantOrderId = invoice.id;
    const order = await paymobCreateOrder({
      authToken,
      amountCents,
      merchantOrderId,
      currency: "EGP",
    });

    const paymentKey = await paymobPaymentKey({
      authToken,
      orderId: order.id,
      integrationId: cfg.integrationId,
      amountCents,
      billingData: {
        first_name: body.customer.first_name,
        last_name: body.customer.last_name,
        phone_number: body.customer.phone,
        email: body.customer.email,
      },
      currency: "EGP",
    });

    await admin.from("invoices").update({ paymob_order_id: order.id }).eq("id", invoice.id);
    await admin.from("payments").insert({
      workspace_id: body.workspace_id,
      invoice_id: invoice.id,
      amount_egp: body.amount_egp,
      currency: "EGP",
      status: "initiated",
      raw_payload: { paymob_order_id: order.id },
    });

    await writeAuditLog({
      workspace_id: body.workspace_id,
      actor_user_id: userId,
      action: "billing.initiate",
      entity_type: "invoice",
      entity_id: invoice.id,
      metadata: { requested_tier: body.requested_tier, amount_egp: body.amount_egp, paymob_order_id: order.id },
    });

    const iframeUrl = buildPaymobIframeUrl(cfg.iframeId, paymentKey);
    return jsonResponse({ invoice_id: invoice.id, paymob_order_id: order.id, iframe_url: iframeUrl });
  } catch (error) {
    await captureError({ where: "paymob_create_payment", error, workspace_id: body.workspace_id, actor_user_id: userId });
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
}
