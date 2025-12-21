import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  MessageCircle,
  BookOpen,
  X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChannelDocs } from "@/hooks/useChannelDocs";
import { MarkdownViewer } from "@/components/docs/MarkdownViewer";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import {
  ChannelType,
  disableChannel,
  enableChannel,
  getChannelsForAgent,
} from "@/services/channels";

/* =============================
   TYPES
============================= */
type Channel = {
  id: ChannelType;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled?: boolean;
  beta?: boolean;
};

/* =============================
   DATA (UI ONLY)
============================= */
const CHANNEL_LIBRARY: Omit<Channel, "enabled">[] = [
  {
    id: "webchat",
    title: "Webchat",
    desc: "Add a floating chat widget to your site.",
    icon: MessageSquare,
  },
  {
    id: "whatsapp_cloud",
    title: "WhatsApp Cloud",
    desc: "Respond to WhatsApp messages.",
    icon: MessageCircle,
  },
  {
    id: "facebook_messenger",
    title: "Facebook Messenger",
    desc: "Chat with customers on Facebook.",
    icon: MessageCircle,
  },
];

/* =============================
   CHANNEL CARD
============================= */
function ChannelCard({
  channel,
  onOpenDocs,
  onToggle,
  isLoading,
}: {
  channel: Channel;
  onOpenDocs: () => void;
  onToggle: (nextEnabled: boolean) => void;
  isLoading: boolean;
}) {
  const Icon = channel.icon;

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
        {/* ICON */}
        <div className="h-14 w-14 sm:h-10 sm:w-10 rounded-xl bg-white border flex items-center justify-center">
          <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
        </div>

        {/* TEXT */}
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

      {/* ACTIONS */}
      <div className="mt-4 flex items-center justify-between">
        {/* Docs */}
        <button
          onClick={onOpenDocs}
          className="text-muted-foreground hover:text-foreground"
          title="View documentation"
        >
          <BookOpen className="h-4 w-4" />
        </button>

        <Button
          variant={channel.enabled ? "secondary" : "outline"}
          size="sm"
          onClick={() => onToggle(!channel.enabled)}
          disabled={isLoading}
        >
          {channel.enabled ? "Disable" : "Enable"}
        </Button>
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
              <h4 className="font-semibold text-base">{doc.title || `${channel.title} Docs`}</h4>
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
  const { workspace } = useWorkspace();
  const baseChannels = useMemo(
    () => CHANNEL_LIBRARY.map((c) => ({ ...c, enabled: false })),
    []
  );
  const [channels, setChannels] = useState<Channel[]>(baseChannels);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loadingChannelId, setLoadingChannelId] = useState<ChannelType | null>(null);

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;

  const fetchAgentId = useCallback(async (workspaceId: string) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }, []);

  const loadChannels = useCallback(
    async (agent: string) => {
      const rows = await getChannelsForAgent(agent);
      const states = CHANNEL_LIBRARY.map((entry) => ({
        ...entry,
        enabled: rows.some(
          (row) => row.channel === entry.id && row.is_enabled
        ),
      }));
      setChannels(states);
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!workspace?.id) {
        setChannels(baseChannels);
        return;
      }

      try {
        const id = await fetchAgentId(workspace.id);
        if (!isMounted) return;
        if (id) {
          setAgentId(id);
          await loadChannels(id);
        } else {
          setChannels(baseChannels);
        }
      } catch (error) {
        console.error("Failed to load channels", error);
        if (isMounted) setChannels(baseChannels);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [workspace?.id, baseChannels, fetchAgentId, loadChannels]);

  const handleToggle = useCallback(
    async (channelId: ChannelType, nextEnabled: boolean) => {
      if (!agentId) return;

      setLoadingChannelId(channelId);
      try {
        if (nextEnabled) {
          await enableChannel(agentId, channelId);
        } else {
          await disableChannel(agentId, channelId);
        }
        await loadChannels(agentId);
      } catch (error) {
        console.error(
          `Failed to ${nextEnabled ? "enable" : "disable"} channel`,
          error
        );
      } finally {
        setLoadingChannelId(null);
      }
    },
    [agentId, loadChannels]
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                onOpenDocs={() => setActiveDoc(c)}
                onToggle={(next) => void handleToggle(c.id, next)}
                isLoading={loadingChannelId === c.id}
              />
            ))}
          </div>
        </div>
      </div>

      {activeDoc && (
        <DocumentationDrawer
          channel={activeDoc}
          onClose={() => setActiveDoc(null)}
        />
      )}
    </div>
  );
}
