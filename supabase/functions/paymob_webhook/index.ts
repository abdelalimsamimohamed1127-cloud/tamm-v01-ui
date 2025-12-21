import { jsonResponse, captureError, writeAuditLog } from "../_shared/observability.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { loadPaymobConfig, verifyPaymobHmac } from "../_shared/paymob.ts";

function getProvidedHmac(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("hmac") || req.headers.get("X-Paymob-HMAC") || null;
}

// Paymob posts a JSON payload. We accept both transaction and order callbacks.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });

  const admin = getSupabaseAdmin();
  const cfg = loadPaymobConfig();
  const providedHmac = getProvidedHmac(req);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const verified = await verifyPaymobHmac({ payload, providedHmac, secret: cfg.hmacSecret });
    const obj = payload?.obj ?? payload;
    const orderId = obj?.order?.id ?? obj?.order_id ?? null;
    const txnId = obj?.id ?? obj?.transaction?.id ?? null;
    const success = obj?.success === true;
    const eventType = payload?.type ?? payload?.event_type ?? "unknown";

    // Resolve invoice by paymob_order_id
    let invoice: any = null;
    if (orderId) {
      const { data } = await admin.from("invoices").select("*").eq("paymob_order_id", orderId).maybeSingle();
      invoice = data;
    }

    await admin.from("paymob_webhook_events").insert({
      workspace_id: invoice?.workspace_id ?? null,
      event_type: eventType,
      verified,
      paymob_order_id: orderId,
      paymob_transaction_id: txnId,
      raw_payload: payload,
    });

    if (invoice && verified) {
      // Update invoice/payment status
      if (success) {
        await admin
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString(), paymob_transaction_id: txnId })
          .eq("id", invoice.id);

        await admin
          .from("payments")
          .insert({
            workspace_id: invoice.workspace_id,
            invoice_id: invoice.id,
            amount_egp: invoice.amount_egp,
            currency: invoice.currency,
            status: "paid",
            paymob_transaction_id: txnId,
            raw_payload: payload,
          });

        // Apply plan tier if requested
        const requestedTier = invoice.metadata?.requested_tier;
        if (requestedTier) {
          await admin.from("workspace_settings").upsert({ workspace_id: invoice.workspace_id, plan_tier: requestedTier }, { onConflict: "workspace_id" });
        }

        await writeAuditLog({
          workspace_id: invoice.workspace_id,
          actor_user_id: null,
          action: "billing.paid",
          entity_type: "invoice",
          entity_id: invoice.id,
          metadata: { paymob_order_id: orderId, paymob_transaction_id: txnId, requested_tier: requestedTier },
        });
      } else {
        await admin
          .from("invoices")
          .update({ status: "failed", paymob_transaction_id: txnId })
          .eq("id", invoice.id);
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    await captureError({ where: "paymob_webhook", error });
    return jsonResponse({ ok: false }, { status: 200 }); // avoid retries storm
  }
}
