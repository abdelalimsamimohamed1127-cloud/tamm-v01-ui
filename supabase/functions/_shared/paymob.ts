import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

function getEnv(name: string, optional = false): string {
  const v = Deno.env.get(name);
  if (!v && !optional) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

const PAYMOB_BASE = "https://accept.paymob.com/api";

export type PaymobConfig = {
  apiKey: string;
  integrationId: number;
  iframeId: number;
  hmacSecret: string;
};

export function loadPaymobConfig(): PaymobConfig {
  return {
    apiKey: getEnv("PAYMOB_API_KEY"),
    integrationId: Number(getEnv("PAYMOB_INTEGRATION_ID")),
    iframeId: Number(getEnv("PAYMOB_IFRAME_ID")),
    hmacSecret: getEnv("PAYMOB_HMAC_SECRET", true),
  };
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${PAYMOB_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paymob error ${res.status}: ${text}`);
  }
  return await res.json() as T;
}

export async function paymobAuthenticate(apiKey: string): Promise<string> {
  const out = await postJson<{ token: string }>("/auth/tokens", { api_key: apiKey });
  return out.token;
}

export async function paymobCreateOrder(params: {
  authToken: string;
  amountCents: number;
  merchantOrderId: string;
  currency?: string;
}): Promise<{ id: number }> {
  // NOTE: minimal order schema.
  const out = await postJson<{ id: number }>("/ecommerce/orders", {
    amount_cents: params.amountCents,
    currency: params.currency ?? "EGP",
    merchant_order_id: params.merchantOrderId,
    delivery_needed: "false",
    items: [],
  }, params.authToken);
  return { id: out.id };
}

export async function paymobPaymentKey(params: {
  authToken: string;
  orderId: number;
  integrationId: number;
  amountCents: number;
  billingData: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email: string;
  };
  currency?: string;
}): Promise<string> {
  const billing = {
    apartment: "NA",
    email: params.billingData.email,
    floor: "NA",
    first_name: params.billingData.first_name,
    street: "NA",
    building: "NA",
    phone_number: params.billingData.phone_number,
    shipping_method: "NA",
    postal_code: "NA",
    city: "Cairo",
    country: "EG",
    last_name: params.billingData.last_name,
    state: "Cairo",
  };

  const out = await postJson<{ token: string }>("/acceptance/payment_keys", {
    amount_cents: params.amountCents,
    expiration: 3600,
    order_id: params.orderId,
    billing_data: billing,
    currency: params.currency ?? "EGP",
    integration_id: params.integrationId,
    lock_order_when_paid: "true",
  }, params.authToken);
  return out.token;
}

export function buildPaymobIframeUrl(iframeId: number, paymentToken: string): string {
  return `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;
}

// Paymob HMAC verification (transaction callback)
export async function verifyPaymobHmac(params: {
  payload: any;
  providedHmac: string | null;
  secret: string;
}): Promise<boolean> {
  if (!params.secret || !params.providedHmac) return false;
  const t = params.payload?.obj ?? params.payload;
  if (!t) return false;
  const v = (x: any) => (x === null || x === undefined) ? "" : String(x);
  const data = [
    v(t.amount_cents),
    v(t.created_at),
    v(t.currency),
    v(t.error_occured),
    v(t.has_parent_transaction),
    v(t.id),
    v(t.integration_id),
    v(t.is_3d_secure),
    v(t.is_auth),
    v(t.is_capture),
    v(t.is_refunded),
    v(t.is_standalone_payment),
    v(t.is_voided),
    v(t.order?.id),
    v(t.owner),
    v(t.pending),
    v(t.source_data?.pan),
    v(t.source_data?.sub_type),
    v(t.source_data?.type),
    v(t.success),
  ].join("");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(params.secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed.toLowerCase() === params.providedHmac.toLowerCase();
}
