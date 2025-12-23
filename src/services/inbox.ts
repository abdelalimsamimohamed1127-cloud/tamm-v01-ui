import { supabase } from '@/integrations/supabase/client'

export type ConversationRow = {
  id: string
  channel_id: string
  external_user_id: string
  status: 'open' | 'handoff' | 'closed'
  updated_at: string
  channels?: { name: string; type: string } | null
}

export type MessageRow = {
  id: string
  direction: 'in' | 'out'
  sender_type: 'customer' | 'ai' | 'human'
  message_text: string
  is_draft?: boolean
  created_at: string
}

export type ChannelRow = { id: string; name: string; type: string }

export const getConversations = async (
  workspaceId: string,
  channelId: string | null,
) => {
  const query = supabase
    .from('conversations')
    .select('id,channel_id,external_user_id,status,updated_at,channels(name,type)')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(200)

  const { data, error } = channelId && channelId !== 'all'
    ? await query.eq('channel_id', channelId)
    : await query

  if (error) throw error
  return (data ?? []) as ConversationRow[]
}

export const getConversationMessages = async (workspaceId: string, conversationId: string) => {
  const { data, error } = await supabase
    .from('channel_messages')
    .select('id,direction,sender_type,message_text,is_draft,created_at')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) throw error
  return (data ?? []) as MessageRow[]
}

export const sendMessage = async (
  workspaceId: string,
  conversationId: string,
  channelId: string,
  payload: { direction: 'out' | 'in'; sender_type: 'human' | 'ai' | 'customer'; message_text: string; is_draft?: boolean }
) => {
  const { error } = await supabase.from('channel_messages').insert({
    workspace_id: workspaceId,
    channel_id: channelId,
    conversation_id: conversationId,
    direction: payload.direction,
    sender_type: payload.sender_type,
    message_text: payload.message_text,
    raw_payload: { source: 'inbox' },
    is_draft: payload.is_draft ?? false,
  })

  if (error) throw error
}

export const getChannels = async (workspaceId: string) => {
  const { data, error } = await supabase
    .from('channels')
    .select('id,name,type')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ChannelRow[]
}
