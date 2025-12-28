import { jsonResponse, captureError, writeAuditLog } from "../_shared/observability.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts"; // Assuming getSupabaseAdmin uses SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // Corrected import to use supabase-js@2

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// HMAC fields provided by Paymob for verification
const hmacFields = [
  (obj: any) => obj?.amount_cents,
  (obj: any) => obj?.created_at,
  (obj: any) => obj?.currency,
  (obj: any) => obj?.error_occured,
  (obj: any) => obj?.has_parent_transaction,
  (obj: any) => obj?.id,
  (obj: any) => obj?.integration_id,
  (obj: any) => obj?.is_3d_secure,
  (obj: any) => obj?.is_auth,
  (obj: any) => obj?.is_capture,
  (obj: any) => obj?.is_refunded,
  (obj: any) => obj?.is_standalone_payment,
  (obj: any) => obj?.is_voided,
  (obj: any) => obj?.order?.id, // This is Paymob's order ID, used to retrieve merchant_order_id
  (obj: any) => obj?.owner,
  (obj: any) => obj?.pending,
  (obj: any) => obj?.source_data?.pan,
  (obj: any) => obj?.source_data?.sub_type,
  (obj: any) => obj?.source_data?.type,
  (obj: any) => obj?.success,
];

function getProvidedHmac(req: Request, payload: any): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("hmac") || payload?.hmac || payload?.obj?.hmac || null;
}

async function verifyHmac(obj: any, providedHmac: string | null): Promise<boolean> {
  const secret = Deno.env.get("PAYMOB_HMAC_SECRET") ?? "";
  if (!secret || !providedHmac) {
    console.warn("HMAC secret or provided HMAC missing.");
    return false;
  }
  const v = (x: any) => (x === null || x === undefined) ? "" : String(x);
  const data = hmacFields.map((fn) => v(fn(obj))).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hmacMatch = computed.toLowerCase() === providedHmac.toLowerCase();
  if (!hmacMatch) {
    console.warn(`HMAC mismatch. Provided: ${providedHmac}, Computed: ${computed}`);
  }
  return hmacMatch;
}

function calculatePeriodDates(startDate: Date): { start: string, end: string } {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + 1); // For monthly subscriptions
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ received: true, message: "Method Not Allowed" }, { status: 405 });
  }

  const request_id = req.headers.get("X-Request-ID") || crypto.randomUUID(); // Generate unique request ID
  let payload: any;
  let workspaceId: string | undefined; // To store workspace_id for audit logging
  let paymobTxnId: string | undefined;

  try {
    payload = await req.json();
  } catch (e) {
    console.error("Failed to parse request body as JSON:", e);
    await captureError({
      where: "paymob_webhook_parse",
      error: e,
      metadata: { request_id: request_id },
    });
    return jsonResponse({ received: true, message: "Bad Request - Invalid JSON" }, { status: 400 });
  }

  const obj = payload?.obj ?? payload;
  const providedHmac = getProvidedHmac(req, payload);

  try {
    // Attempt to extract workspace_id and paymobTxnId early for audit logging
    workspaceId = obj?.order?.merchant_order_id ?? undefined;
    paymobTxnId = obj?.id?.toString() ?? undefined;

    await writeAuditLog({
        workspace_id: workspaceId || "unknown", // Use "unknown" if not resolved yet
        actor_user_id: null,
        action: "webhook_received",
        entity_type: "paymob_webhook",
        metadata: {
            request_id: request_id,
            source: "paymob",
            paymob_transaction_id: paymobTxnId,
            paymob_order_id: obj?.order?.id,
            payload_summary: {
                type: payload?.type,
                event_type: payload?.event_type,
                obj_success: obj?.success,
                obj_amount: obj?.amount_cents,
            },
        },
    });

    const hmacOk = await verifyHmac(obj, providedHmac);
    if (!hmacOk) {
      console.warn("HMAC verification failed for webhook payload.");
      await writeAuditLog({
          workspace_id: workspaceId || "unknown",
          actor_user_id: null,
          action: "signature_failed",
          entity_type: "paymob_webhook",
          metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId, provided_hmac: providedHmac },
      });
      return jsonResponse({ received: false, message: "Forbidden - HMAC mismatch" }, { status: 403 });
    }

    if (!workspaceId || !uuidRegex.test(workspaceId)) {
      console.warn(`Invalid or missing workspace ID in payload: ${workspaceId}`);
      await captureError({
        where: "paymob_webhook_validation",
        error: new Error(`Invalid or missing workspace ID: ${workspaceId}`),
        workspace_id: workspaceId,
        metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId },
      });
      return jsonResponse({ received: true, message: "Bad Request - Invalid Workspace ID" }, { status: 400 });
    }
    if (!paymobTxnId) {
        console.warn("Missing Paymob transaction ID in payload.");
        await captureError({
            where: "paymob_webhook_validation",
            error: new Error("Missing Paymob transaction ID"),
            workspace_id: workspaceId,
            metadata: { request_id: request_id },
        });
        return jsonResponse({ received: true, message: "Bad Request - Missing Paymob Transaction ID" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Idempotency check: Check if this specific Paymob transaction ID has already been processed for a subscription update.
    // Assuming `provider_subscription_id` in `public.subscriptions` can store the Paymob transaction ID for initial payments.
    const { data: existingSubscriptionForTxn } = await admin
      .from("subscriptions")
      .select("id")
      .eq("provider_subscription_id", paymobTxnId)
      .limit(1)
      .maybeSingle();

    if (existingSubscriptionForTxn) {
      console.info(`Idempotent webhook: Paymob transaction ID ${paymobTxnId} already processed for subscription update.`);
      await writeAuditLog({
          workspace_id: workspaceId,
          actor_user_id: null,
          action: "webhook_duplicate_received",
          entity_type: "paymob_webhook",
          entity_id: existingSubscriptionForTxn.id,
          metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId },
      });
      return jsonResponse({ received: true, message: "Transaction already processed" });
    }

    // Determine plan_key from amount_cents (placeholder, ideally from metadata)
    let plan_key: string | null = null;
    const amount_cents = obj?.amount_cents;
    if (amount_cents === 0) plan_key = "free"; // For free plans, if ever applicable via checkout
    else if (amount_cents === 9900) plan_key = "starter"; // $99.00
    else if (amount_cents === 24900) plan_key = "pro"; // $249.00
    // Add other plan mappings here. This is a fragile approach; metadata is preferred.

    if (!plan_key) {
        console.warn(`Could not determine plan_key from amount_cents: ${amount_cents}`);
        await captureError({
            where: "paymob_webhook_plan_mapping",
            error: new Error(`Could not determine plan_key from amount_cents: ${amount_cents}`),
            workspace_id: workspaceId,
            metadata: { request_id: request_id, amount_cents: amount_cents },
        });
        return jsonResponse({ received: true, message: "Unknown plan amount" }, { status: 400 });
    }

    const transactionSuccess = obj?.success === true;
    let subscriptionStatus: 'active' | 'pending' | 'canceled' | 'expired' = transactionSuccess ? 'active' : 'canceled';
    
    const now = new Date();
    const { start: current_period_start, end: current_period_end } = calculatePeriodDates(now);

    let subscriptionIdToUpdate: string | undefined;

    // --- Start: Logic to ensure only one active subscription per workspace (mirroring activate_subscription) ---
    // Mark any existing active or pending subscriptions for this workspace as expired/canceled.
    // This ensures only ONE active subscription per workspace.
    const { error: expireError } = await admin
        .from("subscriptions")
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq("workspace_id", workspaceId)
        .in("status", ['active', 'pending']);

    if (expireError) {
        console.error(`Failed to expire previous subscriptions for workspace ${workspaceId}:`, expireError);
        await captureError({
            where: "paymob_webhook_expire_sub",
            error: expireError,
            workspace_id: workspaceId,
            metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId },
        });
        throw expireError;
    }
    // --- End: Logic to ensure only one active subscription per workspace ---


    // Try to find an existing subscription with the same provider_subscription_id (Paymob Txn ID)
    // This handles idempotency for the same payment event being re-sent.
    const { data: existingSubscriptionByTxnRef } = await admin
        .from("subscriptions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("provider", "paymob")
        .eq("provider_subscription_id", paymobTxnId)
        .limit(1)
        .maybeSingle();

    if (existingSubscriptionByTxnRef) {
        // If a subscription with this provider_subscription_id exists, update it.
        // This handles cases where the webhook is re-sent for the same transaction.
        subscriptionIdToUpdate = existingSubscriptionByTxnRef.id;
        const { error: updateError } = await admin
            .from("subscriptions")
            .update({
                plan_key: plan_key,
                status: subscriptionStatus,
                current_period_start: current_period_start,
                current_period_end: current_period_end,
                updated_at: now.toISOString(),
            })
            .eq("id", subscriptionIdToUpdate);

        if (updateError) {
            console.error(`Failed to update subscription ${subscriptionIdToUpdate}:`, updateError);
            await captureError({
                where: "paymob_webhook_update_sub",
                error: updateError,
                workspace_id: workspaceId,
                metadata: { request_id: request_id, subscription_id: subscriptionIdToUpdate, paymob_transaction_id: paymobTxnId },
            });
            throw updateError;
        }
        console.log(`Updated existing subscription ${subscriptionIdToUpdate} for workspace ${workspaceId} to ${plan_key} (status: ${subscriptionStatus}).`);

    } else {
        // No existing subscription with this provider_subscription_id, so insert a new one.
        const { data: newSubscription, error: insertError } = await admin
            .from("subscriptions")
            .insert({
                workspace_id: workspaceId,
                plan_key: plan_key,
                status: subscriptionStatus,
                current_period_start: current_period_start,
                current_period_end: current_period_end,
                provider: 'paymob',
                provider_subscription_id: paymobTxnId, // Use txn ID for this event as reference
                updated_at: now.toISOString(),
            })
            .select("id")
            .single();

        if (insertError) {
            console.error(`Failed to insert new subscription for workspace ${workspaceId}:`, insertError);
            await captureError({
                where: "paymob_webhook_insert_sub",
                error: insertError,
                workspace_id: workspaceId,
                metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId },
            });
            throw insertError;
        }
        subscriptionIdToUpdate = newSubscription.id;
        console.log(`Inserted new subscription ${subscriptionIdToUpdate} for workspace ${workspaceId} to ${plan_key} (status: ${subscriptionStatus}).`);
    }

    // Update workspace_settings if transaction was successful
    if (transactionSuccess) {
        const { error: updateSettingsError } = await admin
            .from("workspace_settings")
            .upsert(
                {
                    workspace_id: workspaceId,
                    plan_key: plan_key,
                    updated_at: now.toISOString(),
                },
                { onConflict: "workspace_id" } // Upsert based on workspace_id
            );

        if (updateSettingsError) {
            console.error(`Failed to update workspace_settings for ${workspaceId}:`, updateSettingsError);
            await captureError({
                where: "paymob_webhook_update_settings",
                error: updateSettingsError,
                workspace_id: workspaceId,
                metadata: { request_id: request_id, plan_key: plan_key },
            });
            throw updateSettingsError;
        }
        console.log(`Updated workspace_settings for ${workspaceId} to plan ${plan_key}.`);
        await writeAuditLog({
            workspace_id: workspaceId,
            actor_user_id: null,
            action: "plan_changed",
            entity_type: "workspace",
            entity_id: workspaceId,
            metadata: { request_id: request_id, new_plan_key: plan_key, paymob_transaction_id: paymobTxnId },
        });
    } else {
        console.log(`Payment failed for ${workspaceId}. Workspace settings plan_key not updated.`);
        await writeAuditLog({
            workspace_id: workspaceId,
            actor_user_id: null,
            action: "payment_failed",
            entity_type: "workspace",
            entity_id: workspaceId,
            metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId, amount_cents: amount_cents },
        });
    }

    // Log payment_confirmed if transaction was successful
    if (transactionSuccess) {
        await writeAuditLog({
            workspace_id: workspaceId,
            actor_user_id: null,
            action: "payment_confirmed",
            entity_type: "subscription",
            entity_id: subscriptionIdToUpdate,
            metadata: { request_id: request_id, paymob_transaction_id: paymobTxnId, plan_key: plan_key, amount_cents: amount_cents },
        });
    }

    console.log(`Paymob webhook processed for workspace ${workspaceId}, transaction ID ${paymobTxnId}.`);
    return jsonResponse({ received: true, message: "Webhook processed successfully" });

  } catch (error) {
    console.error(`Error processing Paymob webhook for workspace ${obj?.order?.merchant_order_id ?? 'unknown'}:`, error);
    await captureError({
        where: "paymob_webhook_global_catch",
        error: error,
        workspace_id: workspaceId,
        metadata: {
            request_id: request_id,
            paymob_order_id: obj?.order?.id,
            paymob_transaction_id: paymobTxnId,
        },
    });
    return jsonResponse({ received: true, message: "Internal Server Error" }, { status: 500 });
  }
}

