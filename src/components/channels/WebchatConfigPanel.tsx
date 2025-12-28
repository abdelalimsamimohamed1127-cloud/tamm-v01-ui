import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { upsertChannelConfig, ChannelPlatform, AgentChannel } from "@/services/channels";
import { X, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

type WebchatConfig = {
  is_active: boolean;
  allowed_domains: string[];
};

type PanelProps = {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  agentChannel?: AgentChannel;
};

const isValidDomain = (domain: string): boolean => {
  if (!domain) return false;
  // Simple regex for domain validation
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
  return domainRegex.test(domain);
};

export function WebchatConfigPanel({
  agentId,
  isOpen,
  onClose,
  onSaveSuccess,
  agentChannel,
}: PanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [domains, setDomains] = useState("");
  const [errors, setErrors] = useState<{ domains?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsActive(agentChannel?.config?.is_active ?? false);
    setDomains((agentChannel?.config?.allowed_domains ?? []).join("\n"));
  }, [agentChannel]);
  
  const embedBaseUrl = import.meta.env.VITE_EMBED_BASE_URL || window.location.origin;
  const embedCode = `<script
  src="${embedBaseUrl}/embed.js"
  data-agent-id="${agentId}">
</script>`;

  const validateAndParseDomains = (): string[] | null => {
    const domainList = domains.split('\n').map(d => d.trim()).filter(Boolean);
    for (const domain of domainList) {
      if (!isValidDomain(domain)) {
        setErrors({ domains: `Invalid domain format: ${domain}` });
        return null;
      }
    }
    setErrors({});
    return domainList;
  };

  const handleSave = async () => {
    const parsedDomains = validateAndParseDomains();
    if (parsedDomains === null) {
      return;
    }

    setIsLoading(true);
    try {
      const config: WebchatConfig = {
        is_active: isActive,
        allowed_domains: parsedDomains,
      };
      const status = isActive ? 'connected' : 'disconnected';

      await upsertChannelConfig(agentId, "webchat", config, status);
      toast.success("Webchat configuration saved.");
      onSaveSuccess();
    } catch (error) {
      toast.error("Failed to save configuration", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 animate-in fade-in-0"
        onClick={onClose}
      />
      <div className="relative h-full w-full sm:w-[420px] bg-white border-l shadow-xl animate-in slide-in-from-right-fast flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="font-semibold">Configure Webchat</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <Label htmlFor="is_active" className="font-medium">Enable Webchat</Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="allowed_domains">Allowed Domains (optional)</Label>
            <Textarea
              id="allowed_domains"
              placeholder="example.com&#10;app.example.com"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              disabled={isLoading}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Enter one domain per line. If empty, the widget will work on all sites.
            </p>
            {errors.domains && <p className="text-xs text-destructive">{errors.domains}</p>}
          </div>

          <div className="space-y-2">
            <Label>Embed Code</Label>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto relative">
              <code>{embedCode}</code>
              <div className="absolute top-2 right-2">
                <CopyButton valueToCopy={embedCode} />
              </div>
            </pre>
          </div>
        </div>

        <div className="shrink-0 p-4 border-t bg-white">
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
