import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export async function writeAuditLog(params: {
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  await admin.from("audit_logs").insert({
    workspace_id: params.workspace_id,
    actor_user_id: params.actor_user_id,
    action: params.action,
    entity_type: params.entity_type ?? null,
    entity_id: params.entity_id ?? null,
    metadata: params.metadata ?? {},
  });
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    status: init?.status ?? 200,
  });
}

export async function captureError(params: {
  where: string;
  error: unknown;
  workspace_id?: string | null;
  actor_user_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const err = params.error instanceof Error ? params.error : new Error(String(params.error));
  console.error(`[${params.where}]`, err);

  if (params.workspace_id) {
    await writeAuditLog({
      workspace_id: params.workspace_id,
      actor_user_id: params.actor_user_id ?? null,
      action: "error",
      entity_type: params.where,
      entity_id: null,
      metadata: {
        message: err.message,
        stack: err.stack,
        ...(params.metadata ?? {}),
      },
    }).catch(() => {});
  }
}