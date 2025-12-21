import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from "../_shared/supabase.ts";

type Body = {
  workspace_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  rating: 1 | -1;
  comment?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.workspace_id || !body?.rating) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const ok = await assertWorkspaceMember({ supabase, workspaceId: body.workspace_id, userId });
    if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

    await supabase.from("message_feedback").insert({
      workspace_id: body.workspace_id,
      conversation_id: body.conversation_id ?? null,
      message_id: body.message_id ?? null,
      rating: body.rating,
      comment: body.comment ?? null,
    });

    return jsonResponse({ ok: true }, 200);
  } catch (e) {
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
