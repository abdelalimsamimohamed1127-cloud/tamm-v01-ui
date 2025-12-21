import { jsonResponse, captureError, writeAuditLog } from "../_shared/observability.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { verifyPaymobHmac } from "../_shared/paymob.ts";

function getProvidedHmac(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("hmac") || req.headers.get("X-Paymob-HMAC") || null;
}

function getEventId(payload: any): string {
  const obj = payload?.obj ?? payload;
  const candidates = [payload?.id, obj?.id, obj?.transaction?.id, obj?.order?.id, obj?.order_id];
  const hit = candidates.find((v) => v !== undefined && v !== null);
  return String(hit ?? crypto.randomUUID());
}

function parseTimestamp(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function normalizeEventType(raw: string | null, obj: any): string {
  const v = (raw ?? "").toLowerCase();
  if (v === "subscription.created") return "subscription.created";
  if (v === "subscription.renewed") return "subscription.renewed";
  if (v === "subscription.canceled") return "subscription.canceled";
  if (v === "payment.failed") return "payment.failed";
  if (obj?.success === true) return "subscription.renewed";
  if (obj?.is_voided) return "subscription.canceled";
  return "payment.failed";
}

function mapStatus(eventType: string): "active" | "trialing" | "past_due" | "canceled" {
  switch (eventType) {
    case "subscription.created":
      return "trialing";
    case "subscription.renewed":
      return "active";
    case "subscription.canceled":
      return "canceled";
    default:
      return "past_due";
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const secret = Deno.env.get("PAYMOB_HMAC_SECRET");
  if (!secret) return jsonResponse({ ok: false, error: "missing_hmac_secret" }, { status: 500 });

  const admin = getSupabaseAdmin();
  let eventId = "";
  let orderId: string | number | null = null;
  let transactionId: string | number | null = null;
  let eventType = "";
  let workspaceId: string | null = null;

  try {
    const providedHmac = getProvidedHmac(req);
    const verified = await verifyPaymobHmac({ payload, providedHmac, secret });
    const obj = payload?.obj ?? payload;
    eventId = getEventId(payload);
    orderId = obj?.order?.id ?? obj?.order_id ?? null;
    transactionId = obj?.id ?? obj?.transaction?.id ?? null;
    const providerSubscriptionId = obj?.subscription_id ?? obj?.subscription?.id ?? null;
    eventType = normalizeEventType(payload?.type ?? payload?.event_type ?? obj?.type ?? null, obj);

    const { data: existingEvent } = await admin
      .from("paymob_webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      return jsonResponse({ ok: true, deduped: true });
    }

    await admin.from("paymob_webhook_events").upsert({
      event_id: eventId,
      workspace_id: null,
      event_type: eventType,
      verified,
      paymob_order_id: orderId,
      paymob_transaction_id: transactionId,
      raw_payload: payload,
    }, { onConflict: "event_id" });

    if (!verified) {
      return jsonResponse({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    workspaceId = obj?.workspace_id ?? obj?.metadata?.workspace_id ?? null;
    let requestedPlan: string | null = obj?.plan ?? obj?.metadata?.plan ?? null;
    let subscriptionRef: string | null = providerSubscriptionId;
    let fallbackStart: string | null = parseTimestamp(obj?.current_period_start ?? obj?.period_start);
    let fallbackEnd: string | null = parseTimestamp(obj?.current_period_end ?? obj?.period_end);

    if (orderId) {
      const { data: invoice } = await admin
        .from("invoices")
        .select("id, workspace_id, metadata, subscription_id, created_at")
        .eq("paymob_order_id", orderId)
        .maybeSingle();

      if (invoice) {
        workspaceId = invoice.workspace_id ?? workspaceId;
        requestedPlan = invoice.metadata?.requested_tier ?? invoice.metadata?.plan ?? requestedPlan;
        subscriptionRef = subscriptionRef ?? invoice.subscription_id ?? orderId?.toString() ?? null;
        fallbackStart = fallbackStart ?? invoice.created_at ?? null;
      }
    }

    if (workspaceId) {
      await admin
        .from("paymob_webhook_events")
        .update({ workspace_id: workspaceId })
        .eq("event_id", eventId);
    }

    const status = mapStatus(eventType);
    const nowIso = new Date().toISOString();
    let subscriptionId: string | null = null;

    if (workspaceId) {
      const { data: existingSub } = await admin
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const baseUpdate = {
        workspace_id: workspaceId,
        plan: requestedPlan ?? existingSub?.plan ?? null,
        status,
        provider: "paymob",
        provider_subscription_id: subscriptionRef ?? existingSub?.provider_subscription_id ?? null,
        current_period_start: fallbackStart ?? existingSub?.current_period_start ?? nowIso,
        current_period_end: fallbackEnd ?? existingSub?.current_period_end ?? null,
        updated_at: nowIso,
      };

      if (existingSub) {
        const { data: updated } = await admin
          .from("subscriptions")
          .update(baseUpdate)
          .eq("id", existingSub.id)
          .select()
          .maybeSingle();
        subscriptionId = updated?.id ?? existingSub.id;
      } else {
        const { data: inserted } = await admin
          .from("subscriptions")
          .insert({ ...baseUpdate, created_at: nowIso })
          .select()
          .maybeSingle();
        subscriptionId = inserted?.id ?? null;
      }
    }

    if (workspaceId) {
      await writeAuditLog({
        workspace_id: workspaceId,
        actor_user_id: null,
        action: `billing.${eventType}`,
        entity_type: "subscription",
        entity_id: subscriptionId,
        metadata: {
          paymob_order_id: orderId,
          paymob_transaction_id: transactionId,
          provider_subscription_id: subscriptionRef,
          status,
          verified,
          event_id: eventId,
          current_period_start: fallbackStart,
          current_period_end: fallbackEnd,
        },
      });
    }

    return jsonResponse({
      ok: true,
      status,
      subscription_id: subscriptionId,
      workspace_id: workspaceId,
    });
  } catch (error) {
    await captureError({
      where: "paymob-webhook",
      error,
      workspace_id: workspaceId,
      metadata: {
        order_id: orderId,
        transaction_id: transactionId,
        event_id: eventId,
        event_type: eventType,
      },
    });
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 200 });
  }
}
