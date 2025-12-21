import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function getAuthUserId(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';

  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

export async function assertWorkspaceMember(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  workspaceId: string;
  userId: string;
}) {
  const { supabase, workspaceId, userId } = params;

  // Owner shortcut
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, owner_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (ws?.owner_id === userId) return true;

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!member;
}

export async function isTammAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from('tamm_admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}
