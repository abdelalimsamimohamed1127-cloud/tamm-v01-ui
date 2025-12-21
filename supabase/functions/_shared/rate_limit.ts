import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RateLimitOptions = {
  key: string;
  windowSeconds: number;
  max: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function enforceRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (opts.windowSeconds * 1000)) *
      (opts.windowSeconds * 1000),
  );
  const resetAt = new Date(windowStart.getTime() + opts.windowSeconds * 1000);

  // Atomic-ish upsert + increment.
  // Using SQL via rpc is ideal; for MVP we use update then insert fallback.
  const { data: existing, error: selErr } = await admin
    .from("rate_limits")
    .select("key, window_start, count")
    .eq("key", opts.key)
    .maybeSingle();
  if (selErr) throw selErr;

  if (!existing || new Date(existing.window_start).getTime() !== windowStart.getTime()) {
    // New window
    const { error: upsertErr } = await admin
      .from("rate_limits")
      .upsert({ key: opts.key, window_start: windowStart.toISOString(), count: 1 }, {
        onConflict: "key",
      });
    if (upsertErr) throw upsertErr;
    return { allowed: true, remaining: Math.max(0, opts.max - 1), resetAt: resetAt.toISOString() };
  }

  const nextCount = (existing.count ?? 0) + 1;
  if (nextCount > opts.max) {
    return { allowed: false, remaining: 0, resetAt: resetAt.toISOString() };
  }

  const { error: updErr } = await admin
    .from("rate_limits")
    .update({ count: nextCount, updated_at: new Date().toISOString() })
    .eq("key", opts.key)
    .eq("window_start", existing.window_start);
  if (updErr) throw updErr;

  return {
    allowed: true,
    remaining: Math.max(0, opts.max - nextCount),
    resetAt: resetAt.toISOString(),
  };
}
