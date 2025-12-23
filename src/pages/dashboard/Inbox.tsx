import { useEffect, useMemo, useState, type ElementType } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getConversations, type Conversation, type ConversationMessage } from "@/services/inbox"
import { Search, MessageCircle, Globe, Facebook, Send } from "lucide-react"

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

  useEffect(() => {
    getConversations(status).then((data) => {
      setConversations(data)
      setSelectedSessionId(data[0]?.id ?? null)
    })
  }, [status])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return conversations.filter((conversation) =>
      term ? conversation.customer_name.toLowerCase().includes(term) || conversation.last_message.toLowerCase().includes(term) : true
    )
  }, [conversations, search])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedSessionId) ?? null,
    [conversations, selectedSessionId]
  )

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      <Card className="w-full lg:w-[38%] flex flex-col">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Inbox</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="pl-10"
            />
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
            {filteredConversations.length === 0 && (
              <div className="text-sm text-muted-foreground p-4">No conversations found.</div>
            )}
            {filteredConversations.map((conversation) => {
              const Icon = channelIconMap[conversation.channel]
              const isActive = conversation.id === selectedSessionId
              const showUrgent = conversation.urgency === "high" || conversation.sentiment === "negative"
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedSessionId(conversation.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition flex flex-col gap-1",
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold truncate">{conversation.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {showUrgent && <span className="h-2 w-2 rounded-full bg-destructive" />}
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(conversation.updated_at)}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{conversation.last_message}</div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col">
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a conversation to view details.</div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{selectedConversation.customer_name}</div>
                <div className="text-sm text-muted-foreground capitalize">{selectedConversation.channel}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Resolve</Button>
                <Button variant="secondary">Handoff</Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {selectedConversation.messages?.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t flex items-center gap-2">
              <Input
                placeholder="Type a reply..."
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
              />
              <Button disabled>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
