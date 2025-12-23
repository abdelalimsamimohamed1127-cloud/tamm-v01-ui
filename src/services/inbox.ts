export type ConversationMessage = {
  id: string
  sender: 'user' | 'assistant'
  content: string
  timestamp: string
}

export type Conversation = {
  id: string
  customer_name: string
  last_message: string
  channel: 'webchat' | 'whatsapp' | 'messenger'
  status: 'open' | 'resolved' | 'handoff'
  urgency: 'low' | 'high'
  sentiment: 'neutral' | 'negative'
  updated_at: string
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
    ],
  },
  {
    id: '3',
    customer_name: '+1 (555) 123-4567',
    last_message: 'Customer requested a human handoff.',
    channel: 'messenger',
    status: 'handoff',
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
    status: 'open',
    urgency: 'low',
    sentiment: 'neutral',
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
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
    ],
  },
]

export async function getConversations(status: Conversation['status']): Promise<Conversation[]> {
  return Promise.resolve(mockConversations.filter((conversation) => conversation.status === status))
}
