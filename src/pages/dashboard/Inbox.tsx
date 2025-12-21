import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, Sparkles, Hand, HandMetal } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConversationRow = {
  id: string;
  channel_id: string;
  external_user_id: string;
  status: 'open' | 'handoff' | 'closed';
  updated_at: string;
  channels?: { name: string; type: string } | null;
};

type MessageRow = {
  id: string;
  direction: 'in' | 'out';
  sender_type: 'customer' | 'ai' | 'human';
  message_text: string;
  is_draft?: boolean;
  created_at: string;
};

type ChannelRow = { id: string; name: string; type: string };

export default function Inbox() {
  const { dir } = useLanguage();
  const { workspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);

  const drafts = useMemo(() => messages.filter((m) => Boolean(m.is_draft)), [messages]);
  const timeline = useMemo(() => messages.filter((m) => !Boolean(m.is_draft)), [messages]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');

  const selectedConversationRow = useMemo(
    () => conversations.find((c) => c.id === selectedConversation) ?? null,
    [conversations, selectedConversation]
  );

  useEffect(() => {
    if (!workspace) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    if (!selectedConversation || !workspace) return;
    void fetchMessages(selectedConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  async function loadAll() {
    if (!workspace || !isSupabaseConfigured) return;
    setLoading(true);
    await Promise.all([fetchChannels(), fetchConversations()]);
    setLoading(false);
  }

  async function fetchChannels() {
    if (!workspace) return;
    const { data } = await supabase
      .from('channels')
      .select('id,name,type')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true });
    setChannels((data ?? []) as any);
  }

  async function fetchConversations() {
    if (!workspace) return;
    const q = supabase
      .from('conversations')
      .select('id,channel_id,external_user_id,status,updated_at,channels(name,type)')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false })
      .limit(200);

    const { data } =
      selectedChannel === 'all'
        ? await q
        : await q.eq('channel_id', selectedChannel);

    setConversations((data ?? []) as any);

    if (!selectedConversation && (data ?? []).length > 0) {
      setSelectedConversation((data ?? [])[0].id);
    }
  }

  async function fetchMessages(conversationId: string) {
    if (!workspace) return;
    const { data } = await supabase
      .from('channel_messages')
      .select('id,direction,sender_type,message_text,is_draft,created_at')
      .eq('workspace_id', workspace.id)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(500);

    setMessages((data ?? []) as any);
  }

  async function sendHumanMessage() {
    if (!workspace || !selectedConversationRow) return;
    if (!newMessage.trim()) return;

    await supabase.from('channel_messages').insert({
      workspace_id: workspace.id,
      channel_id: selectedConversationRow.channel_id,
      conversation_id: selectedConversationRow.id,
      direction: 'out',
      sender_type: 'human',
      message_text: newMessage.trim(),
      raw_payload: { source: 'inbox' },
      is_draft: false,
    });

    setNewMessage('');
    await fetchMessages(selectedConversationRow.id);
    await fetchConversations();
  }

  async function requestHandoff() {
    if (!workspace || !selectedConversationRow) return;
    await supabase.functions.invoke('request_handoff', {
      body: {
        workspace_id: workspace.id,
        conversation_id: selectedConversationRow.id,
        reason: 'owner_enabled',
      },
    });
    await fetchConversations();
    await fetchMessages(selectedConversationRow.id);
  }

  async function releaseHandoff() {
    if (!workspace || !selectedConversationRow) return;
    await supabase.functions.invoke('release_handoff', {
      body: {
        workspace_id: workspace.id,
        conversation_id: selectedConversationRow.id,
      },
    });
    await fetchConversations();
    await fetchMessages(selectedConversationRow.id);
  }

  async function sendDraft(draftMessageId: string) {
    if (!workspace) return;
    await supabase.functions.invoke('send_draft_message', {
      body: { workspace_id: workspace.id, draft_message_id: draftMessageId },
    });
    if (selectedConversationRow) await fetchMessages(selectedConversationRow.id);
  }

  async function generateDraft() {
    if (!workspace || !selectedConversationRow) return;
    await supabase.functions.invoke('generate_draft', {
      body: {
        workspace_id: workspace.id,
        channel_id: selectedConversationRow.channel_id,
        conversation_id: selectedConversationRow.id,
      },
    });
    await fetchMessages(selectedConversationRow.id);
  }

  const filteredConversations = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return conversations;
    return conversations.filter((c) => (c.external_user_id ?? '').toLowerCase().includes(s));
  }, [conversations, search]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4" dir={dir}>
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Left: conversation list */}
        <Card className="lg:w-80 flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={dir === 'rtl' ? 'بحث...' : 'Search...'}
                  className="pl-10 rtl:pl-3 rtl:pr-10"
                />
              </div>
            </div>

            <Select value={selectedChannel} onValueChange={(v) => { setSelectedChannel(v); void fetchConversations(); }}>
              <SelectTrigger>
                <SelectValue placeholder={dir === 'rtl' ? 'القناة' : 'Channel'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dir === 'rtl' ? 'كل القنوات' : 'All channels'}</SelectItem>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.name} • {ch.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {drafts.length > 0 && (
  <Card className="p-3 border-dashed">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <div className="text-sm font-medium">{dir === 'rtl' ? 'اقتراحات الذكاء الاصطناعي' : 'AI Suggestions'}</div>
        <Badge variant="secondary">{drafts.length}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {dir === 'rtl' ? 'لن تُرسل تلقائيًا' : 'Not sent automatically'}
      </div>
    </div>
    <div className="mt-3 space-y-2">
      {drafts.slice(-3).map((d) => (
        <div key={d.id} className="rounded-lg border p-2 bg-muted/40">
          <div className="text-sm whitespace-pre-wrap">{d.message_text}</div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => void sendDraft(d.id)}>
              {dir === 'rtl' ? 'إرسال' : 'Send'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  </Card>
)}

                <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">{dir === 'rtl' ? 'تحميل...' : 'Loading...'}</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">{dir === 'rtl' ? 'لا توجد محادثات' : 'No conversations'}</div>
            ) : (
              <div className="p-2">
                {filteredConversations.map((conv) => (
                  <motion.button
                    key={conv.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={cn(
                      'w-full p-3 rounded-lg text-left flex items-center gap-3 hover:bg-muted/50 transition',
                      selectedConversation === conv.id && 'bg-muted'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{(conv.external_user_id ?? 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{conv.external_user_id}</p>
                        <Badge variant={conv.status === 'handoff' ? 'destructive' : 'secondary'}>
                          {conv.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(conv.channels?.name ?? 'Channel')} • {new Date(conv.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Right: messages */}
        <Card className="flex-1 flex flex-col">
          {!selectedConversationRow ? (
            <div className="p-6 text-sm text-muted-foreground">{dir === 'rtl' ? 'اختر محادثة' : 'Select a conversation'}</div>
          ) : (
            <>
              <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{(selectedConversationRow.external_user_id ?? 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{selectedConversationRow.external_user_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedConversationRow.channels?.name ?? 'Channel'} • {selectedConversationRow.channels?.type}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConversationRow.status === 'handoff' ? (
                    <Button size="sm" variant="outline" onClick={releaseHandoff}>
                      <HandMetal className="h-4 w-4 mr-2" />
                      {dir === 'rtl' ? 'إلغاء التحويل' : 'Release handoff'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={requestHandoff}>
                      <Hand className="h-4 w-4 mr-2" />
                      {dir === 'rtl' ? 'تحويل لبشر' : 'Handoff to human'}
                    </Button>
                  )}

                  <Button size="sm" variant="secondary" onClick={generateDraft}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {dir === 'rtl' ? 'اقتراح رد' : 'Draft reply'}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {timeline.map((m) => {
                    const isMe = m.sender_type !== 'customer';
                    const isDraft = Boolean(m.is_draft);
                    return (
                      <div
                        key={m.id}
                        className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                            isMe ? 'bg-primary text-primary-foreground' : 'bg-muted',
                            isDraft && 'ring-2 ring-amber-400 bg-amber-50 text-amber-900'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs opacity-80">
                              {m.sender_type}{isDraft ? ' (draft)' : ''}
                            </span>
                            <span className="text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString()}</span>
                          </div>
                          <div className="mt-1">{m.message_text}</div>
                          {isDraft && (
                            <div className="mt-2 flex justify-end">
                              <Button size="sm" variant="secondary" onClick={() => sendDraft(m.id)}>
                                Send draft
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={dir === 'rtl' ? 'اكتب رد الفريق...' : 'Type a team reply...'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void sendHumanMessage();
                    }}
                  />
                  <Button onClick={sendHumanMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {selectedConversationRow.status === 'handoff' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dir === 'rtl'
                      ? 'المحادثة في وضع تحويل لبشر: الذكاء الاصطناعي لن يرسل ردود تلقائيًا.'
                      : 'Conversation is in handoff: AI will not send automatic replies.'}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
