import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Mail,
  Zap,
  Slack,
  Globe,
  Phone,
  Instagram,
  MessageCircle,
  Webhook,
  BookOpen,
  X,
} from "lucide-react";

/* =============================
   TYPES
============================= */
type Channel = {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled?: boolean;
  beta?: boolean;
};

/* =============================
   DATA (UI ONLY)
============================= */
const CHANNELS: Channel[] = [
  {
    id: "widget",
    title: "Chat Widget",
    desc: "Add a floating chat widget to your site.",
    icon: MessageSquare,
    enabled: true,
  },
  {
    id: "help",
    title: "Help Page",
    desc: "Standalone ChatGPT-style help page.",
    icon: Globe,
  },
  {
    id: "email",
    title: "Email",
    desc:
      "Connect your agent to an email address and let it respond to messages from your customers.",
    icon: Mail,
    beta: true,
  },
  {
    id: "zapier",
    title: "Zapier",
    desc: "Connect your agent with thousands of apps using Zapier.",
    icon: Zap,
  },
  { id: "slack", title: "Slack", desc: "Reply in Slack.", icon: Slack },
  {
    id: "whatsapp",
    title: "WhatsApp",
    desc: "Respond to WhatsApp messages.",
    icon: Phone,
  },
  {
    id: "instagram",
    title: "Instagram",
    desc: "Respond to DMs.",
    icon: Instagram,
  },
  {
    id: "messenger",
    title: "Messenger",
    desc: "Facebook Messenger.",
    icon: MessageCircle,
  },
  {
    id: "api",
    title: "API",
    desc: "REST API access.",
    icon: Webhook,
  },
];

/* =============================
   CHANNEL CARD
============================= */
function ChannelCard({
  channel,
  onOpenDocs,
}: {
  channel: Channel;
  onOpenDocs: () => void;
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
        >
          {channel.enabled ? "Manage" : "Subscribe to enable"}
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

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;

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
            {CHANNELS.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                onOpenDocs={() => setActiveDoc(c)}
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
