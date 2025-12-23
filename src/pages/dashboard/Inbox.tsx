import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Send,
  Sparkles,
  Hand,
  HandMetal,
  Filter,
  Globe,
  Facebook,
  MessageCircle,
  MessagesSquare,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getChannels,
  getConversations,
  getConversationMessages,
  sendMessage,
  type ConversationRow,
  type MessageRow,
  type ChannelRow,
} from "@/services/inbox";
import { getBillingSnapshot } from "@/services/billing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StatusFilter = "open" | "closed" | "handoff";
type BillingState = "normal" | "warning" | "blocked";

const channelIconMap: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  webchat: Globe,
  messenger: Facebook,
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export default function Inbox() {
  const { dir } = useLanguage();
  const { workspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [lastMessagePreview, setLastMessagePreview] = useState<Record<string, string>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, boolean>>({});
  const [billingStatus, setBillingStatus] = useState<BillingState>("normal");

  const selectedConversationRow = useMemo(
    () => conversations.find((c) => c.id === selectedConversation) ?? null,
    [conversations, selectedConversation]
  );

  const fetchChannels = useCallback(async () => {
    const data = await getChannels(workspace.id);
    setChannels(data);
  }, [workspace.id]);

  const fetchConversations = useCallback(async () => {
    const data = await getConversations(workspace.id, selectedChannel);
    setConversations(data);
    setSelectedConversation((prev) => prev ?? data?.[0]?.id ?? null);
  }, [workspace.id, selectedChannel]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      const data = await getConversationMessages(workspace.id, conversationId);
      setMessages(data);

      const latest = data.at(-1);
      if (latest) {
        setLastMessagePreview((prev) => ({ ...prev, [conversationId]: latest.message_text }));
        setUnreadByConversation((prev) => ({
          ...prev,
          [conversationId]: latest.direction === "in" && latest.sender_type === "customer",
        }));
      }
    },
    [workspace.id]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChannels(), fetchConversations()]).finally(() => setLoading(false));
  }, [fetchChannels, fetchConversations]);

  useEffect(() => {
    getBillingSnapshot().then((snapshot) => {
      const percent =
        snapshot.usage.messagesLimit === 0
          ? 0
          : (snapshot.usage.messagesUsed / snapshot.usage.messagesLimit) * 100;
      if (percent > 100) return setBillingStatus("blocked");
      if (percent >= 70) return setBillingStatus("warning");
      return setBillingStatus("normal");
    });
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    void fetchMessages(selectedConversation);
  }, [selectedConversation, fetchMessages]);

  const filteredConversations = useMemo(() => {
    const s = search.trim().toLowerCase();
    return conversations
      .filter((c) => c.status === statusFilter)
      .filter((c) => (!unreadOnly ? true : unreadByConversation[c.id] ?? c.status !== "closed"))
      .filter((c) => (s ? (c.external_user_id ?? "").toLowerCase().includes(s) : true));
  }, [conversations, statusFilter, unreadOnly, unreadByConversation, search]);

  const statusLabel: Record<StatusFilter, string> = {
    open: dir === "rtl" ? "مفتوح" : "Open",
    closed: dir === "rtl" ? "محلول" : "Resolved",
    handoff: dir === "rtl" ? "تحويل" : "Handoff",
  };

  const channelLabel = (type?: string) => type?.toLowerCase() ?? "channel";
  const ChannelIcon = ({ type }: { type?: string }) => {
    const Icon = channelIconMap[type?.toLowerCase() ?? ""] ?? MessagesSquare;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  async function sendHumanMessage() {
    if (billingStatus === "blocked") return;
    if (!selectedConversationRow) return;
    if (!newMessage.trim()) return;

    await sendMessage(workspace.id, selectedConversationRow.id, selectedConversationRow.channel_id, {
      direction: "out",
      sender_type: "human",
      message_text: newMessage.trim(),
      is_draft: false,
    });

    setNewMessage("");
    await fetchMessages(selectedConversationRow.id);
    await fetchConversations();
  }

  async function requestHandoff() {
    if (!selectedConversationRow) return;
    await fetchConversations();
    await fetchMessages(selectedConversationRow.id);
  }

  async function releaseHandoff() {
    if (!selectedConversationRow) return;
    await fetchConversations();
    await fetchMessages(selectedConversationRow.id);
  }

  async function sendDraft(draftMessageId: string) {
    if (selectedConversationRow) await fetchMessages(selectedConversationRow.id);
  }

  async function generateDraft() {
    if (!selectedConversationRow) return;
    await fetchMessages(selectedConversationRow.id);
  }

  const timeline = useMemo(() => messages.filter((m) => !Boolean(m.is_draft)), [messages]);
  const drafts = useMemo(() => messages.filter((m) => Boolean(m.is_draft)), [messages]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-3" dir={dir}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="open">{statusLabel.open}</TabsTrigger>
            <TabsTrigger value="closed">{statusLabel.closed}</TabsTrigger>
            <TabsTrigger value="handoff">{statusLabel.handoff}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          {billingStatus === "warning" && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {dir === "rtl" ? "قرب الحد" : "Approaching usage limit"}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {selectedChannel !== "all" && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedChannel("all")}>
                All channels
              </DropdownMenuItem>
              {channels.map((ch) => (
                <DropdownMenuItem key={ch.id} onClick={() => setSelectedChannel(ch.id)}>
                  {ch.name} • {ch.type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <Switch id="unread-only" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            <label htmlFor="unread-only" className="text-sm text-muted-foreground cursor-pointer">
              {dir === "rtl" ? "غير مقروء فقط" : "Unread only"}
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        <Card className="w-full lg:w-80 flex flex-col">
          <div className="p-3 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dir === "rtl" ? "بحث..." : "Search..."}
                className="pl-10 rtl:pl-3 rtl:pr-10"
              />
            </div>

            {drafts.length > 0 && (
              <Card className="p-3 border-dashed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <div className="text-sm font-medium">{dir === "rtl" ? "اقتراحات" : "AI Suggestions"}</div>
                    <Badge variant="secondary">{drafts.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dir === "rtl" ? "لن تُرسل تلقائيًا" : "Not sent automatically"}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {drafts.slice(-3).map((d) => (
                    <div key={d.id} className="rounded-lg border p-2 bg-muted/40">
                      <div className="text-sm whitespace-pre-wrap">{d.message_text}</div>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void sendDraft(d.id)}>
                          {dir === "rtl" ? "إرسال" : "Send"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                {dir === "rtl" ? "لا توجد محادثات" : "No conversations"}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredConversations.map((conv) => {
                  const preview = lastMessagePreview[conv.id] ?? (conv.channels?.name ?? "No messages yet");
                  const isActive = selectedConversation === conv.id;
                  const isUnread = unreadByConversation[conv.id] ?? conv.status !== "closed";
                  return (
                    <motion.button
                      key={conv.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left flex items-center gap-3 transition",
                        isActive ? "bg-muted" : "hover:bg-muted/50"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{(conv.external_user_id ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{conv.external_user_id}</p>
                          <span className="text-xs text-muted-foreground">{formatTime(conv.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ChannelIcon type={conv.channels?.type} />
                          <p className="truncate">{preview}</p>
                        </div>
                        {conv.status === "handoff" && (
                          <Badge variant="destructive" className="text-[10px]">
                            {dir === "rtl" ? "يتطلب بشري" : "Human Needed"}
                          </Badge>
                        )}
                      </div>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col">
          {!selectedConversationRow ? (
            <div className="p-6 text-sm text-muted-foreground">
              {dir === "rtl" ? "اختر محادثة" : "Select a conversation"}
            </div>
          ) : (
            <>
              <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>
                      {(selectedConversationRow.external_user_id ?? "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{selectedConversationRow.external_user_id}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <ChannelIcon type={selectedConversationRow.channels?.type} />
                      <span>
                        {selectedConversationRow.channels?.name ?? "Channel"} •{" "}
                        {channelLabel(selectedConversationRow.channels?.type)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedConversationRow.status === "handoff" ? (
                    <Button size="sm" variant="outline" onClick={releaseHandoff}>
                      <HandMetal className="h-4 w-4 mr-2" />
                      {dir === "rtl" ? "إلغاء التحويل" : "Release handoff"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={requestHandoff}>
                      <Hand className="h-4 w-4 mr-2" />
                      {dir === "rtl" ? "تحويل لبشر" : "Handoff to human"}
                    </Button>
                  )}

                  <Button size="sm" variant="secondary" onClick={generateDraft}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {dir === "rtl" ? "اقتراح رد" : "Draft reply"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailsOpen((prev) => !prev)}
                    className="flex items-center gap-2"
                  >
                    <Info className="h-4 w-4" />
                    {dir === "rtl" ? (detailsOpen ? "إخفاء التفاصيل" : "عرض التفاصيل") : detailsOpen ? "Hide details" : "Show details"}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {timeline.map((m) => {
                    const isMe = m.sender_type !== "customer";
                    const isDraft = Boolean(m.is_draft);
                    return (
                      <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                            isDraft && "ring-2 ring-amber-400 bg-amber-50 text-amber-900"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs opacity-80">
                              {m.sender_type}
                              {isDraft ? " (draft)" : ""}
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
                {billingStatus === "blocked" && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{dir === "rtl" ? "تم تجاوز الحد" : "Plan limit exceeded"}</AlertTitle>
                    <AlertDescription>
                      {dir === "rtl"
                        ? "تم إيقاف إرسال الرسائل مؤقتاً. الرجاء الترقية لاستمرار الاستخدام."
                        : "Message sending is temporarily paused. Upgrade to continue."}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={dir === "rtl" ? "اكتب رد الفريق..." : "Type a team reply..."}
                    disabled={billingStatus === "blocked"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendHumanMessage();
                    }}
                  />
                  <Button onClick={sendHumanMessage} disabled={billingStatus === "blocked"}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {selectedConversationRow.status === "handoff" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dir === "rtl"
                      ? "المحادثة في وضع تحويل لبشر: الذكاء الاصطناعي لن يرسل ردود تلقائيًا."
                      : "Conversation is in handoff: AI will not send automatic replies."}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>

        {detailsOpen && selectedConversationRow && (
          <Card className="hidden xl:flex w-80 flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {(selectedConversationRow.external_user_id ?? "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{selectedConversationRow.external_user_id}</div>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversationRow.channels?.name ?? "Channel"} • {channelLabel(selectedConversationRow.channels?.type)}
                  </p>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {dir === "rtl" ? "تفاصيل العميل" : "Customer details"}
                </div>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{dir === "rtl" ? "اسم" : "Name"}</span>
                    <span className="font-medium">{selectedConversationRow.external_user_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{dir === "rtl" ? "القناة" : "Channel"}</span>
                    <div className="flex items-center gap-2">
                      <ChannelIcon type={selectedConversationRow.channels?.type} />
                      <span>{selectedConversationRow.channels?.name ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{dir === "rtl" ? "الحالة" : "Status"}</span>
                    <Badge variant="secondary" className="capitalize">
                      {selectedConversationRow.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>{dir === "rtl" ? "الطلبات الأخيرة" : "Recent orders"}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {dir === "rtl" ? "قريباً" : "Soon"}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  {dir === "rtl" ? "لا توجد طلبات متاحة بعد." : "No orders available yet."}
                </div>
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}
