import { supabase } from '@/integrations/supabase/client'

export type Ticket = {
  id: string
  workspace_id: string
  session_id: string
  subject: string | null
  description: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

export async function getTickets(workspaceId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createTicket(data: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
  const { data: inserted, error } = await supabase.from('tickets').insert(data).select('*').single()

  if (error) {
    throw error
  }

  return inserted as Ticket
}

export async function updateTicketStatus(id: string, status: Ticket['status']): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ status })
    .eq('id', id)

  if (error) {
    throw error
  }
}
