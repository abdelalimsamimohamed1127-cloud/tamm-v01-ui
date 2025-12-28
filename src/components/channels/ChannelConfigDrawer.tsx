import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { upsertChannelConfig } from "@/services/channels";
import { UpsertChannelConfigDTO, ChannelPlatform, AgentChannelStatus } from "@/types/dto/channels.dto";
import { X, Loader2, Info } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { useWorkspace } from "@/hooks/useWorkspace";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

type FormField = {
  id: string;
  label: string;
  placeholder: string;
  isSecret?: boolean;
};

const CHANNEL_CONFIGS: Record<
  "whatsapp" | "messenger" | "instagram",
  { title: string; fields: FormField[]; webhookInfo?: { url: string } }
> = {
  whatsapp: {
    title: "Connect WhatsApp Cloud",
    fields: [
      { id: "phone_number_id", label: "Phone Number ID", placeholder: "" },
      { id: "waba_id", label: "WABA ID", placeholder: "" },
      {
        id: "verify_token",
        label: "Verify Token",
        placeholder: "A secure, random string",
      },
      {
        id: "app_secret_ref",
        label: "App Secret Reference",
        placeholder: "e.g., WHATSAPP_APP_SECRET",
      },
    ],
  },
  messenger: {
    title: "Connect Facebook Messenger",
    fields: [
      { id: "page_id", label: "Page ID", placeholder: "" },
      {
        id: "verify_token_ref",
        label: "Verify Token Reference",
        placeholder: "e.g., MESSENGER_VERIFY_TOKEN",
      },
      {
        id: "app_secret_ref",
        label: "App Secret Reference",
        placeholder: "e.g., MESSENGER_APP_SECRET",
      },
    ],
    webhookInfo: {
      url:
        `${import.meta.env.VITE_WEBHOOK_URL}/messenger` ||
        "https://example.com/api/v1/webhooks/messenger",
    },
  },
  instagram: {
    title: "Connect Instagram",
    fields: [
      { id: "ig_account_id", label: "Instagram Account ID", placeholder: "" },
      { id: "page_id", label: "Associated Page ID", placeholder: "" },
      {
        id: "verify_token_ref",
        label: "Verify Token Reference",
        placeholder: "e.g., INSTAGRAM_VERIFY_TOKEN",
      },
      {
        id: "app_secret_ref",
        label: "App Secret Reference",
        placeholder: "e.g., INSTAGRAM_APP_SECRET",
      },
    ],
     webhookInfo: {
      url:
        `${import.meta.env.VITE_WEBHOOK_URL}/instagram` ||
        "https://example.com/api/v1/webhooks/instagram",
    },
  },
};

type DrawerProps = {
  agentId: string;
  platform: ChannelPlatform;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  existingConfig?: Record<string, any>;
};

export function ChannelConfigDrawer({
  agentId,
  platform,
  isOpen,
  onClose,
  onSaveSuccess,
  existingConfig,
}: DrawerProps) {
  const { workspaceId } = useWorkspace(); // Retrieve workspaceId
  const channelConfig = CHANNEL_CONFIGS[platform];
  const initialConfig = useMemo(() => {
    return channelConfig.fields.reduce((acc, field) => {
      acc[field.id] = existingConfig?.[field.id] ?? "";
      return acc;
    }, {} as Record<string, string>);
  }, [channelConfig, existingConfig]);

  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const validate = () => {
    const newErrors: Partial<Record<string, string>> = {};
    let isValid = true;

    for (const field of channelConfig.fields) {
      if (!config[field.id] || config[field.id].trim() === "") {
        newErrors[field.id] = "This field is required.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }
    
    if (!workspaceId) {
      toast.error("Workspace ID is not available.");
      return;
    }

    setIsLoading(true);
    try {
      const trimmedConfig = Object.fromEntries(
        Object.entries(config).map(([key, value]) => [key, value.trim()])
      );

      // Only set status to 'pending' if it's a new connection.
      const newStatus: AgentChannelStatus | undefined = !existingConfig ? "pending" : undefined;

      const payload: UpsertChannelConfigDTO = {
        workspace_id: workspaceId,
        agent_id: agentId,
        platform: platform,
        config: trimmedConfig,
        ...(newStatus && { status: newStatus }), // Only add status if newStatus is defined
        ...(existingConfig?.id && { id: existingConfig.id }), // Include ID if updating
      };

      await upsertChannelConfig(payload);
      toast.success(`${channelConfig.title.replace("Connect ", "")} configuration saved.`);
      onSaveSuccess();
    } catch (error) {
      toast.error("Failed to save configuration", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const verifyTokenRef = config.verify_token_ref ?? "YOUR_VERIFY_TOKEN_REF";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 animate-in fade-in-0"
        onClick={onClose}
      />
      <div className="relative h-full w-full sm:w-[420px] bg-white border-l shadow-xl animate-in slide-in-from-right-fast flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="font-semibold">{channelConfig.title}</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {channelConfig.fields.map((field) => (
            <div key={field.id} className="grid gap-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                value={config[field.id] ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, [field.id]: e.target.value })
                }
                disabled={isLoading}
                placeholder={field.placeholder}
              />
              {errors[field.id] && <p className="text-xs text-destructive">{errors[field.id]}</p>}
            </div>
          ))}

          {platform === 'messenger' && channelConfig.webhookInfo && (
             <div className="space-y-3 pt-4">
               <h4 className="font-medium">Webhook Configuration</h4>
               <p className="text-sm text-muted-foreground">
                 After saving, go to your Facebook App settings and configure the webhook endpoint.
               </p>
               <div className="space-y-2">
                 <Label>Webhook URL</Label>
                 <div className="flex items-center gap-2">
                    <Input readOnly value={channelConfig.webhookInfo.url} className="bg-muted/50" />
                    <CopyButton valueToCopy={channelConfig.webhookInfo.url} />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label>Verify Token Reference</Label>
                 <div className="flex items-center gap-2">
                    <Input readOnly value={verifyTokenRef} className="bg-muted/50"/>
                    <CopyButton valueToCopy={verifyTokenRef} />
                 </div>
               </div>
             </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t bg-white">
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

