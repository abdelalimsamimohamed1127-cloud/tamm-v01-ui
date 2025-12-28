// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { Card } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import {
//   MessageSquare,
//   MessageCircle,
//   BookOpen,
//   X,
// } from "lucide-react";
// import { useLanguage } from "@/contexts/LanguageContext";
// import { useChannelDocs } from "@/hooks/useChannelDocs";
// import { MarkdownViewer } from "@/components/docs/MarkdownViewer";
// import { useWorkspace } from "@/hooks/useWorkspace";
// import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
// import {
//   ChannelType,
//   disableChannel,
//   enableChannel,
//   getChannelsForAgent,
// } from "@/services/channels";

// /* =============================
//    TYPES
// ============================= */
// type Channel = {
//   id: ChannelType;
//   title: string;
//   desc: string;
//   icon: React.ComponentType<{ className?: string }>;
//   enabled?: boolean;
//   beta?: boolean;
//   agentChannel?: AgentChannel;
//   config?: AgentChannelConfig;
// };

// /* =============================
//    DATA (UI ONLY)
// ============================= */
// const CHANNEL_LIBRARY: Omit<Channel, "enabled">[] = [
//   {
//     id: "webchat",
//     title: "Webchat",
//     desc: "Add a floating chat widget to your site.",
//     icon: MessageSquare,
//   },
//   {
//     id: "whatsapp_cloud",
//     title: "WhatsApp Cloud",
//     desc: "Respond to WhatsApp messages.",
//     icon: MessageCircle,
//     agentChannel: "facebook_messenger",
//   },
//   {
//     id: "facebook_messenger",
//     title: "Facebook Messenger",
//     desc: "Chat with customers on Facebook.",
//     icon: MessageCircle,
//   },
// ];

// /* =============================
//    CHANNEL CARD
// ============================= */
// function ChannelCard({
//   channel,
//   onOpenDocs,
//   onToggle,
//   isLoading,
// }: {
//   channel: Channel;
//   onOpenDocs: () => void;
//   onToggle: (nextEnabled: boolean) => void;
//   isLoading: boolean;
// }) {
//   const Icon = channel.icon;

//   return (
//     <Card
//       className="
//         group relative p-5
//         bg-[radial-gradient(#e5e7eb_1px,transparent_1px)]
//         [background-size:14px_14px]
//         transition hover:shadow-sm
//       "
//     >
//       <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
//         {/* ICON */}
//         <div className="h-14 w-14 sm:h-10 sm:w-10 rounded-xl bg-white border flex items-center justify-center">
//           <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
//         </div>

//         {/* TEXT */}
//         <div className="flex-1">
//           <div className="flex items-center gap-2">
//             <p className="font-semibold">{channel.title}</p>
//             {channel.beta && (
//               <span className="text-xs px-2 py-0.5 rounded-full bg-black text-white">
//                 Beta
//               </span>
//             )}
//           </div>
//           <p className="text-sm text-muted-foreground mt-1">
//             {channel.desc}
//           </p>
//         </div>
//       </div>

//       {/* ACTIONS */}
//       <div className="mt-4 flex items-center justify-between">
//         {/* Docs */}
//         <button
//           onClick={onOpenDocs}
//           className="text-muted-foreground hover:text-foreground"
//           title="View documentation"
//         >
//           <BookOpen className="h-4 w-4" />
//         </button>

//         <Button
//           variant={channel.enabled ? "secondary" : "outline"}
//           size="sm"
//           onClick={() => onToggle(!channel.enabled)}
//           disabled={isLoading}
//         >
//           {channel.enabled ? "Disable" : "Enable"}
//         </Button>
//       </div>
//     </Card>
//   );
// }

// /* =============================
//    DOCUMENTATION DRAWER
// ============================= */
// function DocumentationDrawer({
//   channel,
//   onClose,
// }: {
//   channel: Channel;
//   onClose: () => void;
// }) {
//   const Icon = channel.icon;
//   const { language } = useLanguage();
//   const { doc, isLoading } = useChannelDocs(channel.id, language);

//   return (
//     <div className="fixed inset-0 z-50 flex justify-end">
//       <div
//         className="absolute inset-0 bg-black/30"
//         onClick={onClose}
//       />

//       <div className="relative h-full w-full sm:w-[420px] bg-white border-l shadow-xl animate-in slide-in-from-right">
//         <div className="flex items-center justify-between px-4 py-3 border-b">
//           <div className="flex items-center gap-2">
//             <Icon className="h-5 w-5" />
//             <h3 className="font-semibold">{channel.title} Docs</h3>
//           </div>
//           <button onClick={onClose}>
//             <X className="h-5 w-5 text-muted-foreground" />
//           </button>
//         </div>

//         <div className="p-4 text-sm space-y-4">
//           {isLoading ? (
//             <p className="text-muted-foreground">Loading documentation...</p>
//           ) : doc ? (
//             <div className="space-y-2">
//               <p className="text-xs text-muted-foreground uppercase tracking-wide">
//                 {doc.lang_code} • v{doc.version}
//               </p>
//               <h4 className="font-semibold text-base">{doc.title || `${channel.title} Docs`}</h4>
//               <div className="rounded-lg border p-3 bg-muted/40">
//                 <MarkdownViewer content={doc.content_md} />
//               </div>
//             </div>
//           ) : (
//             <>
//               <p className="text-muted-foreground">
//                 Documentation placeholder.
//               </p>
//               <div className="rounded-lg border p-3 bg-muted/40">
//                 <ul className="list-disc pl-4 space-y-1">
//                   <li>Setup instructions</li>
//                   <li>Permissions</li>
//                   <li>Testing</li>
//                 </ul>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// /* =============================
//    PAGE
// ============================= */
// export default function Channels() {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [leftWidth, setLeftWidth] = useState(28);
//   const [isDragging, setIsDragging] = useState(false);
//   const [activeDoc, setActiveDoc] = useState<Channel | null>(null);
//   const { workspace } = useWorkspace();
//   const baseChannels = useMemo(
//     () => CHANNEL_LIBRARY.map((c) => ({ ...c, enabled: false })),
//     []
//   );
//   const [channels, setChannels] = useState<Channel[]>(baseChannels);
//   const [agentId, setAgentId] = useState<string | null>(null);
//   const [loadingChannelId, setLoadingChannelId] = useState<ChannelType | null>(null);

//   const isMobile =
//     typeof window !== "undefined" && window.innerWidth < 1024;

//   const fetchAgentId = useCallback(async (workspaceId: string) => {
//     if (!supabase || !isSupabaseConfigured) {
//       throw new Error("Supabase not configured");
//     }

//     const { data, error } = await supabase
//       .from("agents")
//       .select("id")
//       .eq("workspace_id", workspaceId)
//       .order("created_at", { ascending: true })
//       .limit(1)
//       .maybeSingle();

//     if (error) throw error;
//     return data?.id ?? null;
//   }, []);

//   const loadChannels = useCallback(
//     async (agent: string) => {
//       const rows = await getChannelsForAgent(agent);
//       const states = CHANNEL_LIBRARY.map((entry) => ({
//         ...entry,
//         enabled: rows.some(
//           (row) => row.channel === entry.id && row.is_enabled
//         ),
//       }));
//       setChannels(states);
//     },
//     []
//   );

//   useEffect(() => {
//     let isMounted = true;

//     const bootstrap = async () => {
//       if (!workspace?.id) {
//         setChannels(baseChannels);
//         return;
//       }

//       try {
//         const id = await fetchAgentId(workspace.id);
//         if (!isMounted) return;
//         if (id) {
//           setAgentId(id);
//           await loadChannels(id);
//         } else {
//           setChannels(baseChannels);
//         }
//       } catch (error) {
//         console.error("Failed to load channels", error);
//         if (isMounted) setChannels(baseChannels);
//       }
//     };

//     void bootstrap();

//     return () => {
//       isMounted = false;
//     };
//   }, [workspace?.id, baseChannels, fetchAgentId, loadChannels]);

//   const handleToggle = useCallback(
//     async (channelId: ChannelType, nextEnabled: boolean) => {
//       if (!agentId) return;

//       setLoadingChannelId(channelId);
//       try {
//         if (nextEnabled) {
//           await enableChannel(agentId, channelId);
//         } else {
//           await disableChannel(agentId, channelId);
//         }
//         await loadChannels(agentId);
//       } catch (error) {
//         console.error(
//           `Failed to ${nextEnabled ? "enable" : "disable"} channel`,
//           error
//         );
//       } finally {
//         setLoadingChannelId(null);
//       }
//     },
//     [agentId, loadChannels]
//   );

//   useEffect(() => {
//     const onMove = (e: MouseEvent) => {
//       if (!isDragging || !containerRef.current) return;
//       const rect = containerRef.current.getBoundingClientRect();
//       const pct = ((e.clientX - rect.left) / rect.width) * 100;
//       setLeftWidth(Math.min(40, Math.max(20, pct)));
//     };
//     const onUp = () => setIsDragging(false);

//     window.addEventListener("mousemove", onMove);
//     window.addEventListener("mouseup", onUp);
//     return () => {
//       window.removeEventListener("mousemove", onMove);
//       window.removeEventListener("mouseup", onUp);
//     };
//   }, [isDragging]);

//   useEffect(() => {
//     let ignore = false;

//     async function load() {
//       if (!workspace || !supabase || !isSupabaseConfigured) {
//         if (!ignore) setChannelState(createDefaultChannelState());
//         return;
//       }

//       const { data: agentRow, error } = await supabase
//         .from("agents")
//         .select("id")
//         .eq("workspace_id", workspace.id)
//         .order("created_at", { ascending: true })
//         .limit(1)
//         .maybeSingle();

//       if (error) {
//         if (!ignore) setChannelState(createDefaultChannelState());
//         return;
//       }

//       const state = await getChannelStateForAgent(agentRow?.id);
//       if (!ignore) setChannelState(state);
//     }

//     load();

//     return () => {
//       ignore = true;
//     };
//   }, [workspace]);

//   const channels = CHANNELS.map((c) => {
//     const state = c.agentChannel
//       ? channelState.channels.find((ch) => ch.channel === c.agentChannel)
//       : null;
//     return {
//       ...c,
//       enabled: state?.is_enabled ?? c.enabled ?? false,
//       config: state?.config ?? c.config,
//     };
//   });

//   return (
//     <div ref={containerRef} className="w-full p-6">
//       <div className="flex h-[calc(100vh-120px)] overflow-hidden">
//         {!isMobile && (
//           <div
//             onMouseDown={() => setIsDragging(true)}
//             className="w-[10px] cursor-col-resize flex items-center justify-center"
//           >
//             <div className="w-[2px] h-full bg-border rounded-full" />
//           </div>
//         )}

//         <div
//           className="flex-1 overflow-y-auto pl-4"
//           style={{ width: isMobile ? "100%" : `${100 - leftWidth}%` }}
//         >
//           <h2 className="mb-4 text-lg font-semibold">All channels</h2>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             {channels.map((c) => (
//               <ChannelCard
//                 key={c.id}
//                 channel={c}
//                 onOpenDocs={() => setActiveDoc(c)}
//                 onToggle={(next) => void handleToggle(c.id, next)}
//                 isLoading={loadingChannelId === c.id}
//               />
//             ))}
//           </div>
//         </div>
//       </div>

//       {activeDoc && (
//         <DocumentationDrawer
//           channel={activeDoc}
//           onClose={() => setActiveDoc(null)}
//         />
//       )}
//     </div>
//   );
// }



import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Mail, MessageCircle, MessageSquare, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChannelDocs } from "@/hooks/useChannelDocs";
import { MarkdownViewer } from "@/components/docs/MarkdownViewer";
import { useWorkspace } from "@/hooks";
import { toast } from "@/components/ui/sonner";
import { getAgentForWorkspace, getAgentChannels, upsertAgentChannel, disconnectAgentChannel, type AgentChannel, type ChannelPlatform } from "@/services";
import { ChannelConfigDrawer, WhatsappConfig } from "@/components/channels/ChannelConfigDrawer";

/* =============================
   TYPES
============================= */
type Channel = {
  id: ChannelPlatform;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  agentChannel?: AgentChannel; // Full agent_channel record from DB
  beta?: boolean;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

/* =============================
   DATA (UI ONLY)
============================= */
const CHANNEL_LIBRARY: Omit<Channel, "agentChannel">[] = [
  {
    id: "webchat",
    title: "Webchat",
    desc: "Add a floating chat widget to your site.",
    icon: MessageSquare,
  },
  {
    id: "whatsapp",
    title: "WhatsApp Cloud",
    desc: "Respond to WhatsApp messages.",
    icon: MessageCircle,
  },
  {
    id: "messenger",
    title: "Facebook Messenger",
    desc: "Chat with customers on Facebook.",
    icon: MessageCircle,
  },
  {
    id: "instagram",
    title: "Instagram",
    desc: "Engage with customers via Instagram DMs.",
    icon: MessageCircle,
  },
  {
    id: "email",
    title: "Email",
    desc:
      "Connect your agent to an email address and let it respond to messages from your customers.",
    icon: Mail,
    beta: true,
  },
];

/* =============================
   CHANNEL CARD
============================= */
function ChannelCard({
  channel,
  onOpenDocs,
  onToggle,
  onConnect,
  isLoading,
}: {
  channel: Channel;
  onOpenDocs: () => void;
  onToggle: (nextEnabled: boolean) => void;
  onConnect: () => void;
  isLoading: boolean;
}) {
  const Icon = channel.icon;
  const status = channel.agentChannel?.status ?? "disconnected";
  const isEnabled = channel.agentChannel?.is_active ?? false;
  const isConfigurable = ['whatsapp', 'messenger', 'instagram'].includes(channel.id);

  const renderActions = () => {
    if (isConfigurable) {
      switch (status) {
        case 'connected':
          return (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border-green-500 text-green-600">Connected</Badge>
              <Button variant="outline" size="sm" onClick={onConnect} disabled={isLoading}>Configure</Button>
            </div>
          );
        case 'pending':
          return (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border-amber-500 text-amber-600">Pending</Badge>
              <Button variant="outline" size="sm" onClick={onConnect} disabled={isLoading}>Configure</Button>
            </div>
          );
        case 'disconnected':
        default:
          return <Button variant="outline" size="sm" onClick={onConnect} disabled={isLoading}>Connect</Button>;
      }
    }
    // Default toggle for other channels like webchat
    return (
      <Button
        variant={isEnabled ? "secondary" : "outline"}
        size="sm"
        onClick={() => onToggle(!isEnabled)}
        disabled={isLoading}
      >
        {isEnabled ? "Disable" : "Enable"}
      </Button>
    );
  }

  return (
    <Card
      className="
        group relative p-5
        bg-[radial-gradient(#e5e7eb_1px,transparent_1px)]
        [background-size:14px_14px]
        transition hover:shadow-sm
      "
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="h-14 w-14 sm:h-10 sm:w-10 rounded-xl bg-white border flex items-center justify-center">
          <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{channel.title}</p>
            {channel.beta && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-black text-white">
                Beta
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {channel.desc}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onOpenDocs}
          className="text-muted-foreground hover:text-foreground"
          title="View documentation"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        {renderActions()}
      </div>
    </Card>
  );
}

/* =============================
   DOCUMENTATION DRAWER
============================= */
function DocumentationDrawer({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const Icon = channel.icon;
  const { language } = useLanguage();
  const { doc, isLoading } = useChannelDocs(channel.id, language);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      <div className="relative h-full w-full sm:w-[420px] bg-white border-l shadow-xl animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="font-semibold">{channel.title} Docs</h3>
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 text-sm space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading documentation...</p>
          ) : doc ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {doc.lang_code} • v{doc.version}
              </p>
              <h4 className="font-semibold text-base">
                {doc.title || `${channel.title} Docs`}
              </h4>
              <div className="rounded-lg border p-3 bg-muted/40">
                <MarkdownViewer content={doc.content_md} />
              </div>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">
                Documentation placeholder.
              </p>
              <div className="rounded-lg border p-3 bg-muted/40">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Setup instructions</li>
                  <li>Permissions</li>
                  <li>Testing</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================
   PAGE
============================= */
export default function Channels() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(28);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Channel | null>(null);
  const [configuringChannel, setConfiguringChannel] = useState<Channel | null>(null);
  const { workspace } = useWorkspace();
  
  const [agentChannels, setAgentChannels] = useState<AgentChannel[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loadingChannelId, setLoadingChannelId] =
    useState<ChannelPlatform | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;
  
  const fetchChannelsData = useCallback(async () => {
    if (!workspace?.id) {
      setAgentId(null);
      setAgentChannels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const agent = await getAgentForWorkspace(workspace.id);
      if (agent?.id) {
        setAgentId(agent.id);
        const rows = await getAgentChannels(agent.id);
        setAgentChannels(rows);
      } else {
        setAgentId(null);
        setAgentChannels([]);
      }
    } catch (error) {
      setAgentId(null);
      setAgentChannels([]);
      toast.error("Failed to load channels", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    fetchChannelsData();
  }, [fetchChannelsData]);

  const handleToggle = useCallback(
    async (channelId: ChannelPlatform, nextEnabled: boolean) => {
      if (!agentId) return;

      const originalChannels = [...agentChannels];
      setAgentChannels(prev => prev.map(c => c.platform === channelId ? { ...c, is_active: nextEnabled } : c));
      setLoadingChannelId(channelId);

      try {
        await toggleChannel(agentId, channelId, nextEnabled);
        toast.success(
          nextEnabled ? "Channel enabled" : "Channel disabled"
        );
      } catch (error) {
        setAgentChannels(originalChannels);
        toast.error("Unable to update channel", {
          description: getErrorMessage(error),
        });
      } finally {
        setLoadingChannelId(null);
      }
    },
    [agentId, agentChannels]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(40, Math.max(20, pct)));
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const channels = useMemo(
    () =>
      CHANNEL_LIBRARY.map((c) => ({
        ...c,
        agentChannel: agentChannels.find(ac => ac.platform === c.id),
      })),
    [agentChannels]
  );

  return (
    <div ref={containerRef} className="w-full p-6">
      <div className="flex h-[calc(100vh-120px)] overflow-hidden">
        {!isMobile && (
          <div
            onMouseDown={() => setIsDragging(true)}
            className="w-[10px] cursor-col-resize flex items-center justify-center"
          >
            <div className="w-[2px] h-full bg-border rounded-full" />
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto pl-4"
          style={{ width: isMobile ? "100%" : `${100 - leftWidth}%` }}
        >
          <h2 className="mb-4 text-lg font-semibold">All channels</h2>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading channels...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map((c) => (
                <ChannelCard
                  key={c.id}
                  channel={c}
                  onOpenDocs={() => setActiveDoc(c)}
                  onToggle={(next) => void handleToggle(c.id, next)}
                  onConnect={() => setConfiguringChannel(c)}
                  isLoading={
                    isLoading || loadingChannelId === c.id || !agentId
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeDoc && (
        <DocumentationDrawer
          channel={activeDoc}
          onClose={() => setActiveDoc(null)}
        />
      )}

      {configuringChannel && ['whatsapp', 'messenger', 'instagram'].includes(configuringChannel.id) && agentId && (
        <ChannelConfigDrawer
          agentId={agentId}
          platform={configuringChannel.id as "whatsapp" | "messenger" | "instagram"}
          isOpen={!!configuringChannel}
          onClose={() => setConfiguringChannel(null)}
          onSaveSuccess={() => {
            setConfiguringChannel(null);
            fetchChannelsData();
          }}
          existingConfig={configuringChannel.agentChannel?.config}
        />
      )}
    </div>
  );
}
