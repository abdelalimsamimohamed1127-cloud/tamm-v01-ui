import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client'

function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

export type Order = {
  id: string
  workspace_id: string
  session_id: string
  customer_name: string | null
  amount: number | null
  status: string
  items: unknown
  created_at: string
  updated_at: string
}

export async function getOrders(workspaceId: string): Promise<Order[]> {
  ensureSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  ensureSupabase();
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)

  if (error) {
    throw error
  }
}
