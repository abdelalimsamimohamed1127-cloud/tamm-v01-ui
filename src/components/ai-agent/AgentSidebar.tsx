import { Settings, Database, MessageSquare } from "lucide-react";

type Props = {
  active: string;
  onChange: (tab: "settings" | "knowledge" | "playground") => void;
};

const Item = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-2 rounded-md text-sm transition
      ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export default function AgentSidebar({ active, onChange }: Props) {
  return (
    <aside className="w-64 border-r bg-background p-4 space-y-2">
      <Item id="settings" label="Agent Settings" icon={Settings} active={active==="settings"} onClick={()=>onChange("settings")} />
      <Item id="knowledge" label="Knowledge Base" icon={Database} active={active==="knowledge"} onClick={()=>onChange("knowledge")} />
      <Item id="playground" label="Playground" icon={MessageSquare} active={active==="playground"} onClick={()=>onChange("playground")} />
    </aside>
  );
}