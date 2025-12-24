import { jsonResponse, captureError } from "../_shared/observability.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  (obj: any) => obj?.order?.id,
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
  if (!secret || !providedHmac) return false;
  const v = (x: any) => (x === null || x === undefined) ? "" : String(x);
  const data = hmacFields.map((fn) => v(fn(obj))).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed.toLowerCase() === providedHmac.toLowerCase();
}

function addMonth(date: Date): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ received: true }, { status: 405 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ received: true }, { status: 400 });
  }

  const obj = payload?.obj ?? payload;
  const providedHmac = getProvidedHmac(req, payload);

  try {
    const hmacOk = await verifyHmac(obj, providedHmac);
    if (!hmacOk) return jsonResponse({ received: false }, { status: 403 });

    if (obj?.success !== true) return jsonResponse({ received: true });

    const workspaceId: string | null = obj?.order?.merchant_order_id ?? obj?.merchant_order_id ?? null;
    if (!workspaceId || !uuidRegex.test(workspaceId)) return jsonResponse({ received: true }, { status: 400 });

    const admin = getSupabaseAdmin();
    const paymobTxnId = obj?.id ?? null;

    const { data: existingTxn } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("metadata->>paymob_transaction_id", String(paymobTxnId ?? ""))
      .limit(1)
      .maybeSingle();

    if (!existingTxn) {
      const credits = obj?.amount_cents === 2900 ? 5000 : 0;
      if (credits > 0) {
        const grantResult = await admin.rpc("grant_credits", {
          ws_id: workspaceId,
          amount: credits,
          reason: "purchase_topup",
          meta: { paymob_transaction_id: paymobTxnId, amount_cents: obj?.amount_cents },
        });

        if (grantResult.error && !`${grantResult.error.message}`.includes("duplicate")) {
          throw grantResult.error;
        }
      }
    }

    await admin
      .from("subscriptions")
      .update({ status: "active", current_period_end: addMonth(new Date()) })
      .eq("workspace_id", workspaceId);

    return jsonResponse({ received: true });
  } catch (error) {
    await captureError({ where: "paymob_webhook", error });
    return jsonResponse({ received: true });
  }
}
