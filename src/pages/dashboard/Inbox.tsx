import { useEffect, useMemo, useState, type ElementType } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  assignConversation,
  getConversations,
  resolveConversation,
  sendInternalNote,
  type Conversation,
  type ConversationMessage,
} from "@/services/inbox"
import {
  Search,
  MessageCircle,
  Globe,
  Facebook,
  Send,
  UserRound,
  Check,
  AlertCircle,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.sender === "user"
  const isInternal = Boolean(message.is_internal_note)
  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}> 
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isInternal
            ? "bg-amber-50 border border-amber-200"
            : isUser
              ? "bg-muted"
              : "bg-primary/10 text-primary"
        )}
      >
        <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(message.timestamp)}</span>
          {isInternal && <Badge variant="outline">Private Note</Badge>}
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  )
}

export default function Inbox() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Conversation["status"]>("open")
  const [search, setSearch] = useState("")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [composerValue, setComposerValue] = useState("")
  const [internalNoteMode, setInternalNoteMode] = useState(false)
  const members = useMemo(() => {
    if (!user) return []
    const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "You"
    return [
      {
        id: user.id,
        name: displayName,
      },
    ]
  }, [user])

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

  const isCustomerInputDisabled = selectedConversation?.status === "handoff_active" && !internalNoteMode

  const handleAssign = async (sessionId: string, userId: string) => {
    try {
      await assignConversation(sessionId, userId)
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === sessionId
            ? { ...conversation, assigned_to: userId, status: "handoff_active" }
            : conversation
        )
      )
    } catch (error) {
      console.error(error)
    }
  }

  const handleResolve = async (sessionId: string) => {
    try {
      await resolveConversation(sessionId)
      setConversations((prev) =>
        prev.map((conversation) => (conversation.id === sessionId ? { ...conversation, status: "resolved" } : conversation))
      )
    } catch (error) {
      console.error(error)
    }
  }

  const handleSend = async () => {
    if (!selectedConversation || !composerValue.trim()) return

    if (internalNoteMode) {
      try {
        await sendInternalNote(selectedConversation.id, composerValue.trim())
        const note: ConversationMessage = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
          sender: "assistant",
          content: composerValue.trim(),
          timestamp: new Date().toISOString(),
          is_internal_note: true,
        }
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversation.id
              ? { ...conversation, messages: [...(conversation.messages ?? []), note] }
              : conversation
          )
        )
        setComposerValue("")
      } catch (error) {
        console.error(error)
      }
    }
  }

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
              <div className="flex gap-2 items-center">
                {selectedConversation.status === "handoff_active" && <Badge variant="secondary">AI Mode: Off</Badge>}
                <Button variant="outline" onClick={() => handleResolve(selectedConversation.id)}>
                  Resolve
                </Button>
              </div>
            </div>

            {selectedConversation.status === "handoff_requested" && (
              <Alert className="m-4 bg-amber-50 border-amber-200 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>User requested human help.</AlertTitle>
                <AlertDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => user && handleAssign(selectedConversation.id, user.id)}
                  >
                    Take Over
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="px-4 py-3 border-b flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {selectedConversation.assigned_to
                            ? getInitials(
                                members.find((m) => m.id === selectedConversation.assigned_to)?.name ||
                                  selectedConversation.assigned_to
                              )
                            : <UserRound className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="text-xs text-muted-foreground">Assigned To</div>
                        <div className="font-medium">
                          {selectedConversation.assigned_to
                            ? members.find((m) => m.id === selectedConversation.assigned_to)?.name || "Assigned"
                            : "Unassigned"}
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Workspace members</DropdownMenuLabel>
                    {members.map((member) => (
                      <DropdownMenuItem key={member.id} onSelect={() => handleAssign(selectedConversation.id, member.id)}>
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">{member.name}</span>
                          {selectedConversation.assigned_to === member.id && <Check className="h-4 w-4" />}
                        </div>
                      </DropdownMenuItem>
                    ))}
                    {members.length === 0 && <DropdownMenuItem disabled>No members available</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {selectedConversation.status === "handoff_active" && <Badge variant="outline">AI Mode: Off</Badge>}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {selectedConversation.messages?.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>

            <div className="px-4 pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch id="internal-note" checked={internalNoteMode} onCheckedChange={setInternalNoteMode} />
                <Label htmlFor="internal-note" className="text-sm">
                  Internal Note
                </Label>
              </div>
            </div>
            <div className="p-4 border-t flex items-center gap-2">
              <Input
                placeholder={internalNoteMode ? "Add a private note..." : "Customer replies are disabled"}
                value={composerValue}
                disabled={isCustomerInputDisabled || !internalNoteMode}
                onChange={(e) => setComposerValue(e.target.value)}
                className={cn(
                  internalNoteMode ? "bg-amber-50 border-amber-200 focus-visible:ring-amber-200" : "",
                  isCustomerInputDisabled ? "cursor-not-allowed" : ""
                )}
              />
              <Button
                onClick={handleSend}
                disabled={isCustomerInputDisabled || !internalNoteMode || composerValue.trim().length === 0}
                className={cn(internalNoteMode ? "bg-amber-500 hover:bg-amber-600 text-white" : "")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
