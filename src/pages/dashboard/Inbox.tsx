import { useEffect, useMemo, useState, type ElementType } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getConversations, getConversationMessages, updateConversationStatus, sendMessage, type Conversation, type ConversationMessage, type ConversationStatus, type MessageSender } from "@/services/inbox"
import { Search, MessageCircle, Globe, Facebook, Send, ArrowLeft, Loader2, RefreshCcw } from "lucide-react"
import { InboxFilters, type InboxFiltersState } from "@/components/inbox/InboxFilters"
import { AnimatePresence, motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks"
import { useToast } from "@/hooks/use-toast"
import { useAgent } from "@/hooks/useAgent"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"



const channelIconMap: Record<string, ElementType> = { // Changed to string as channel can be more varied
  whatsapp: MessageCircle,
  webchat: Globe,
  messenger: Facebook,
}

function formatRelativeTime(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user" || message.role === "human"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <div className="text-xs text-muted-foreground mb-1">
          {isUser ? "You" : message.role}{" "}
          <span className="ml-1">{formatRelativeTime(message.created_at)}</span>
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  )
}

export default function Inbox() {
  const { activeWorkspace } = useWorkspace();
  const { agents } = useAgent(); // Get agents from context
  const { user } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<ConversationStatus>("open")
  const [searchQuery, setSearchQuery] = useState("") // Renamed from search to searchQuery to avoid conflict
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [composerValue, setComposerValue] = useState("")
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [filters, setFilters] = useState<InboxFiltersState>({
    channels: [],
    topics: [],
    sentiment: 'any',
  });
  const isMobile = useIsMobile();

  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<any | undefined>(undefined); // Cursor for pagination
  const [hasMoreConversations, setHasMoreConversations] = useState(true);

  // State for agent filter dropdown
  const [agentFilterId, setAgentFilterId] = useState<string | undefined>(undefined);

  // Effect to fetch conversations
  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const fetchConversations = async () => {
      setIsLoadingConversations(true);
      setConversationsError(null);
      try {
        const result = await getConversations({
          workspaceId: activeWorkspace.id,
          status: status,
          agentId: agentFilterId,
          channel: filters.channels.length > 0 ? filters.channels[0] : undefined, // Assuming single channel filter for now
          search: searchQuery,
          limit: 20, // Default limit, max 50 enforced in service
          cursor: undefined, // Reset cursor for new fetch
        });
        setConversations(result.items);
        setNextCursor(result.nextCursor);
        setHasMoreConversations(!!result.nextCursor);

        // Auto-select first conversation if not mobile and no selection exists
        if(result.items.length > 0 && !selectedSessionId && !isMobile) {
          setSelectedSessionId(result.items[0].id)
        } else if (isMobile) {
          setSelectedSessionId(null);
        }

      } catch (error: any) {
        console.error("Failed to fetch conversations:", error);
        setConversationsError(error.message || "Failed to load conversations.");
        toast({
          title: "Error",
          description: error.message || "Failed to load conversations.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [status, activeWorkspace?.id, agentFilterId, filters.channels, searchQuery, isMobile, toast, selectedSessionId]);

  // Effect to load more conversations
  const loadMoreConversations = async () => {
    if (!activeWorkspace?.id || !nextCursor || isLoadingConversations) return;

    setIsLoadingConversations(true);
    setConversationsError(null);
    try {
      const result = await getConversations({
        workspaceId: activeWorkspace.id,
        status: status,
        agentId: agentFilterId,
        channel: filters.channels.length > 0 ? filters.channels[0] : undefined,
        search: searchQuery,
        limit: 20,
        cursor: nextCursor,
      });
      setConversations((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMoreConversations(!!result.nextCursor);
    } catch (error: any) {
      console.error("Failed to load more conversations:", error);
      setConversationsError(error.message || "Failed to load more conversations.");
      toast({
        title: "Error",
        description: error.message || "Failed to load more conversations.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Reset selected session when filter changes (e.g., status, agent)
  useEffect(() => {
    // Only reset selectedSessionId if it's currently selected and we're not reloading due to a tab change
    // This prevents clearing selection unnecessarily if the user is just browsing a different tab
    // setSelectedSessionId(null);
  }, [status, agentFilterId, filters.channels, searchQuery]);


  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    getConversationMessages(selectedSessionId).then((data) => {
      setMessages(data);
    }).catch(error => {
      console.error("Failed to fetch messages for conversation:", selectedSessionId, error);
      toast({
        title: "Error",
        description: error.message || "Failed to load messages.",
        variant: "destructive",
      });
    })
  }, [selectedSessionId, toast])

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const conversationsChannel = supabase
      .channel(`conversations:${activeWorkspace.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${activeWorkspace.id}`,
      }, (payload) => {
        // Handle conversations changes
        const newConversation = payload.new as Conversation;
        const oldConversation = payload.old as Conversation;

        setConversations(prevConversations => {
          if (payload.eventType === 'INSERT') {
            return [newConversation, ...prevConversations];
          } else if (payload.eventType === 'UPDATE') {
            return prevConversations.map(conv =>
              conv.id === newConversation.id ? newConversation : conv
            );
          } else if (payload.eventType === 'DELETE') {
            return prevConversations.filter(conv => conv.id !== oldConversation.id);
          }
          return prevConversations;
        });
      })
      .subscribe();

    const messagesChannel = supabase
      .channel(`chat_messages:${activeWorkspace.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_chat_messages',
        filter: `workspace_id=eq.${activeWorkspace.id}`,
      }, (payload) => {
        const newMessage = payload.new as ConversationMessage;
        
        // If message is for selected conversation, append it
        if (newMessage.session_id === selectedSessionId) {
          setMessages(prevMessages => [...prevMessages, newMessage]);
        } 
        
        // Update corresponding conversation in the list
        setConversations(prevConversations => {
          return prevConversations.map(conv => {
            if (conv.id === newMessage.session_id) {
              return {
                ...conv,
                last_message_at: newMessage.created_at,
                last_message_preview: newMessage.content,
                unread_count: conv.unread_count + 1,
              };
            }
            return conv;
          });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [activeWorkspace?.id, selectedSessionId, toast]);


  const selectedConversation = useMemo(
    () => {
      const conv = conversations.find((conversation) => conversation.id === selectedSessionId);
      if (conv) {
        return { ...conv, messages };
      }
      return null;
    },
    [conversations, selectedSessionId]
  )
  
  const handleSendMessage = async () => {
    if (!selectedConversation || !composerValue.trim() || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);
    const messageContent = composerValue.trim();
    const temporaryMessageId = `temp-${Date.now()}`;

    // Optimistically append message
    const newMessage: ConversationMessage = {
      id: temporaryMessageId,
      session_id: selectedConversation.id,
      role: "human" as MessageSender, // Changed to human as per prompt rule 3
      content: messageContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setComposerValue(""); // Clear composer immediately

    // Scroll to bottom when new message is sent
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }

    try {
      await sendMessage({ // Use the new sendMessage service
        conversationId: selectedConversation.id,
        content: messageContent,
        senderType: "human",
      });

      toast({ title: "Success", description: "Message sent." });

      // After successful send, trigger a full re-fetch of conversations to update last message/updated_at
      if (activeWorkspace?.id) {
        const result = await getConversations({
          workspaceId: activeWorkspace.id,
          status: status,
          agentId: agentFilterId,
          channel: filters.channels.length > 0 ? filters.channels[0] : undefined,
          search: searchQuery,
          limit: conversations.length || 20,
          cursor: undefined, // Refetch from start to ensure order is correct
        });
        setConversations(result.items);
        setNextCursor(result.nextCursor);
        setHasMoreConversations(!!result.nextCursor);
      }

    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
      // Revert optimistic update if sending failed
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== temporaryMessageId));
      setComposerValue(messageContent); // Restore composer value
    } finally {
      setIsSendingMessage(false);
    }
  };


  const handleStatusChange = async (newStatus: "resolved" | "handoff") => {
    if (!selectedConversation || selectedConversation.status === newStatus) return;

    setIsUpdatingStatus(true);
    const originalConversations = [...conversations];
    const conversationId = selectedConversation.id;

    // Optimistic update
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    setSelectedSessionId(null);

    try {
      const metadata = {
        action: newStatus,
        acted_by: user?.id,
        acted_at: new Date().toISOString(),
      };
      await updateConversationStatus(conversationId, newStatus, metadata);
      toast({
        title: "Success",
        description: `Conversation moved to ${newStatus}.`,
      });
    } catch (error: any) {
      console.error(`Failed to update conversation to ${newStatus}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${newStatus} conversation.`,
        variant: "destructive",
      });
      // Rollback
      setConversations(originalConversations);
      setSelectedSessionId(conversationId);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const conversationListPanel = (
    <Card className={cn("flex-none w-full md:w-80 flex flex-col", isMobile && selectedSessionId ? "hidden" : "flex")}>
        <div className="p-4 border-b space-y-4">
          <h1 className="text-xl font-semibold">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="pl-10 h-9"
              />
            </div>
            <InboxFilters filters={filters} onFiltersChange={setFilters} />
          </div>
          <Tabs value={status} onValueChange={(value) => setStatus(value as ConversationStatus)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="handoff">Handoff</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Agent Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {agentFilterId ? agents.find(a => a.id === agentFilterId)?.name : "All Agents"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuItem onClick={() => setAgentFilterId(undefined)}>All Agents</DropdownMenuItem>
              {agents.map(agent => (
                <DropdownMenuItem key={agent.id} onClick={() => setAgentFilterId(agent.id)}>
                  {agent.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {isLoadingConversations && conversations.length === 0 ? (
              // Loading skeleton/spinner for initial load
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversationsError ? (
              // Error state
              <div className="p-4 text-center text-destructive">
                <p>{conversationsError}</p>
                <Button variant="ghost" onClick={() => {
                  setConversationsError(null);
                  // Force a re-fetch of current state
                  // This is a hacky way to trigger useEffect, consider a dedicated retry state or a refetch function
                  // For now, re-setting status will trigger the useEffect
                  setStatus(prev => prev === 'open' ? 'open' : 'open');
                }}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : conversations.length === 0 ? (
              // Empty state
              <div className="p-4 text-center text-muted-foreground">
                No conversations found.
              </div>
            ) : (
              conversations.map((conversation) => {
                const ChannelIcon = channelIconMap[conversation.channel] ?? MessageCircle
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedSessionId(conversation.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition flex flex-col gap-1",
                      selectedSessionId === conversation.id && !isMobile ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold truncate">{conversation.external_user_id || "Unknown Customer"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(conversation.last_message_at)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{conversation.last_message_preview || "No preview available"}</div>
                    {/* Display enrichment data if available */}
                    {conversation.conversation_enrichment?.topic && (
                      <Badge variant="secondary" className="mt-1 mr-1">
                        {conversation.conversation_enrichment.topic}
                      </Badge>
                    )}
                    {conversation.conversation_enrichment?.sentiment && (
                      <Badge variant="secondary" className="mt-1">
                        {conversation.conversation_enrichment.sentiment}
                      </Badge>
                    )}
                  </button>
                )
              })
            )}
            {hasMoreConversations && (
              <div className="p-2 text-center">
                <Button
                  variant="ghost"
                  onClick={loadMoreConversations}
                  disabled={isLoadingConversations}
                >
                  {isLoadingConversations ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Load More
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
    </Card>
  );

  const conversationDetailPanel = (
    <Card className={cn("flex-1 flex-col overflow-hidden", isMobile ? "w-full h-full rounded-none border-0" : "flex")}>
      <AnimatePresence mode="wait">
          {!selectedConversation ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center text-muted-foreground"
                >
                  Select a conversation to view details.
              </motion.div>
          ) : (
          <motion.div
              key={selectedSessionId}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full bg-background"
          >
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setSelectedSessionId(null)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex flex-col">
                        <div className="text-lg font-semibold">{selectedConversation.external_user_id || "Unknown Customer"}</div>
                        <div className="text-sm text-muted-foreground capitalize">{selectedConversation.channel}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleStatusChange('resolved')} disabled={isUpdatingStatus}>
                      {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Resolve
                    </Button>
                    <Button variant="secondary" onClick={() => handleStatusChange('handoff')} disabled={isUpdatingStatus}>
                      {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Handoff
                    </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4 bg-muted/30">
                <div className="space-y-4">
                    {selectedConversation.messages?.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t flex items-center gap-2 shrink-0 bg-background">
                <Input
                    placeholder="Type a reply..."
                    value={composerValue}
                    onChange={(e) => setComposerValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSendingMessage && composerValue.trim()) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isSendingMessage}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !composerValue.trim()}
                >
                  {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
          </motion.div>
          )}
      </AnimatePresence>
    </Card>
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      {isMobile ? (
        <div className="w-full h-full relative overflow-hidden">
            <AnimatePresence initial={false}>
                <motion.div
                    key="list"
                    animate={{ x: selectedSessionId ? '-100%' : '0%' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                    className="absolute inset-0"
                >
                    {conversationListPanel}
                </motion.div>
                {selectedSessionId && (
                    <motion.div
                        key="detail"
                        initial={{ x: '100%' }}
                        animate={{ x: '0%' }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                        className="absolute inset-0"
                    >
                        {conversationDetailPanel}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      ) : (
        <>
            {conversationListPanel}
            {conversationDetailPanel}
        </>
      )}
    </div>
  )
}
