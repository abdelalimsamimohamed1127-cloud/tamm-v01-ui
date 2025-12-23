import { supabase } from '@/integrations/supabase/client'

export type ConversationStatus =
  | 'open'
  | 'handoff_requested'
  | 'handoff_active'
  | 'resolved'
  | 'closed'

export type ConversationMessage = {
  id: string
  sender: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  is_internal_note?: boolean
}

export type Conversation = {
  id: string
  customer_name: string
  last_message: string
  channel: 'webchat' | 'whatsapp' | 'messenger'
  status: ConversationStatus | 'handoff'
  urgency: 'low' | 'high'
  sentiment: 'neutral' | 'negative'
  updated_at: string
  assigned_to?: string | null
  messages?: ConversationMessage[]
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    customer_name: 'Sofia Ramirez',
    last_message: "I'm still waiting for my order update.",
    channel: 'whatsapp',
    status: 'open',
    urgency: 'high',
    sentiment: 'negative',
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'm1',
        sender: 'user',
        content: "Hi, any update on my delivery?",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'm2',
        sender: 'assistant',
        content: "We're checking with the courier and will update you shortly.",
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
      {
        id: 'm3',
        sender: 'user',
        content: "I'm still waiting for my order update.",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: '2',
    customer_name: 'Alex Johnson',
    last_message: 'Thanks for the quick response!',
    channel: 'webchat',
    status: 'resolved',
    urgency: 'low',
    sentiment: 'neutral',
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    assigned_to: 'user-123',
    messages: [
      {
        id: 'm4',
        sender: 'user',
        content: 'Can you help me reset my password?',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm5',
        sender: 'assistant',
        content: 'Sure, I have sent a password reset link to your email.',
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm6',
        sender: 'user',
        content: 'Thanks for the quick response!',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm6-note',
        sender: 'assistant',
        content: 'Followed up with reset steps and confirmed resolution.',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        is_internal_note: true,
      },
    ],
  },
  {
    id: '3',
    customer_name: '+1 (555) 123-4567',
    last_message: 'Customer requested a human handoff.',
    channel: 'messenger',
    status: 'handoff_requested',
    urgency: 'high',
    sentiment: 'neutral',
    updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'm7',
        sender: 'user',
        content: 'I need to speak with a human agent.',
        timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      },
      {
        id: 'm8',
        sender: 'assistant',
        content: 'I will transfer you to a human agent now.',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: '4',
    customer_name: 'Priya Desai',
    last_message: 'Do you support international shipping?',
    channel: 'webchat',
    status: 'handoff_active',
    urgency: 'low',
    sentiment: 'neutral',
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    assigned_to: 'user-123',
    messages: [
      {
        id: 'm9',
        sender: 'user',
        content: 'Do you support international shipping?',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm10',
        sender: 'assistant',
        content: 'Yes, we ship to most countries. Which destination do you have in mind?',
        timestamp: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm11',
        sender: 'assistant',
        content: 'Holding for human review before confirming policy.',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        is_internal_note: true,
      },
    ],
  },
]

export async function getConversations(status: Conversation['status']): Promise<Conversation[]> {
  const normalizedStatuses =
    status === 'handoff'
      ? ['handoff', 'handoff_requested', 'handoff_active']
      : [status]
  return Promise.resolve(mockConversations.filter((conversation) => normalizedStatuses.includes(conversation.status)))
}

export async function assignConversation(sessionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_sessions')
    .update({ assigned_to: userId, status: 'handoff_active' })
    .eq('id', sessionId)

  if (error) {
    throw error
  }
}

export async function resolveConversation(sessionId: string): Promise<void> {
  const { error } = await supabase.from('chat_sessions').update({ status: 'resolved' }).eq('id', sessionId)

  if (error) {
    throw error
  }
}

export async function sendInternalNote(sessionId: string, content: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content,
    is_internal_note: true,
  })

  if (error) {
    throw error
  }
}
