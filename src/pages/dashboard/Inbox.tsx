import { useEffect, useMemo, useState, type ElementType } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getConversations, type Conversation, type ConversationMessage } from "@/services/inbox"
import { Search, MessageCircle, Globe, Facebook, Send, ArrowLeft } from "lucide-react"
import { InboxFilters, type InboxFiltersState } from "@/components/inbox/InboxFilters"
import { isWithinInterval } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"

const channelIconMap: Record<Conversation["channel"], ElementType> = {
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
  const isUser = message.sender === "user"
  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isUser ? "bg-muted" : "bg-primary/10 text-primary"
        )}
      >
        <div className="text-xs text-muted-foreground mb-1">{formatRelativeTime(message.timestamp)}</div>
        <div>{message.content}</div>
      </div>
    </div>
  )
}

export default function Inbox() {
  const [status, setStatus] = useState<Conversation["status"]>("open")
  const [search, setSearch] = useState("")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [composerValue, setComposerValue] = useState("")
  const [filters, setFilters] = useState<InboxFiltersState>({
    channels: [],
    topics: [],
    sentiment: 'any',
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    getConversations(status).then((data) => {
      setConversations(data)
      if(data.length > 0 && !selectedSessionId && !isMobile) {
        setSelectedSessionId(data[0].id)
      } else if (isMobile) {
        setSelectedSessionId(null);
      }
    })
  }, [status, isMobile])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    
    return conversations.filter((conversation) => {
      const searchMatch = term ? 
        conversation.customer_name.toLowerCase().includes(term) || 
        conversation.last_message.toLowerCase().includes(term) : 
        true;
      const dateMatch = filters.dateRange?.from ? isWithinInterval(new Date(conversation.updated_at), {
        start: filters.dateRange.from,
        end: filters.dateRange.to || filters.dateRange.from,
      }) : true;
      const channelMatch = filters.channels.length > 0 ? filters.channels.includes(conversation.channel) : true;
      const sentimentMatch = filters.sentiment !== 'any' ? conversation.sentiment === filters.sentiment : true;
      
      return searchMatch && dateMatch && channelMatch && sentimentMatch;
    })
  }, [conversations, search, filters])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedSessionId) ?? null,
    [conversations, selectedSessionId]
  )
  
  const conversationListPanel = (
    <Card className={cn(
        "w-full lg:w-[38%] flex flex-col h-full",
        isMobile ? "rounded-none border-0" : ""
    )}>
        <div className="p-4 border-b space-y-4">
          <h1 className="text-xl font-semibold">Inbox</h1>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="pl-10 h-9"
              />
            </div>
            <InboxFilters filters={filters} onFiltersChange={setFilters} />
          </div>
          <Tabs value={status} onValueChange={(value) => setStatus(value as Conversation["status"])}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="handoff">Handoff</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredConversations.map((conversation) => {
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
                        <span className="font-semibold truncate">{conversation.customer_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(conversation.updated_at)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{conversation.last_message}</div>
                </button>
              )
            })}
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
                        <div className="text-lg font-semibold">{selectedConversation.customer_name}</div>
                        <div className="text-sm text-muted-foreground capitalize">{selectedConversation.channel}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Resolve</Button>
                    <Button variant="secondary">Handoff</Button>
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
                />
                <Button disabled> <Send className="h-4 w-4" /> </Button>
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
