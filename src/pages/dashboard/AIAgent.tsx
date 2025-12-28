import React, { useRef, useState, useEffect } from "react"; // Added useEffect
import { useAgent } from "@/hooks/useAgent";
import { AgentSettings } from "@/components/ai-agent/AgentSettings";
import { AgentPlayground } from "@/components/ai-agent/AgentPlayground";
import { AgentKnowledge } from "@/components/ai-agent/AgentKnowledge";
import { Loader2, Info, Save, UploadCloud, History } from "lucide-react"; // Import new icons
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createDraftVersion,
  publishDraft,
  rollbackAgent,
  listAgentVersions,
  AgentVersion,
} from "@/services/agents"; // Import new service functions

export default function AIAgent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("settings");

  const {
    activeAgent,
    isLoading: isAgentContextLoading,
    error: agentContextError,
    refreshAgents, // Destructure refreshAgents
  } = useAgent();

  const { toast } = useToast();

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [agentVersions, setAgentVersions] = useState<AgentVersion[]>([]);
  const [selectedRollbackVersionId, setSelectedRollbackVersionId] = useState<string | null>(null);
  const [isPublishConfirmationOpen, setIsPublishConfirmationOpen] = useState(false);
  const [isRollbackConfirmationOpen, setIsRollbackConfirmationOpen] = useState(false);


  // Fetch agent versions when activeAgent changes
  useEffect(() => {
    if (activeAgent?.id) {
      listAgentVersions(activeAgent.id)
        .then(setAgentVersions)
        .catch((error) => {
          console.error("Error listing agent versions:", error);
          toast({
            title: "Error",
            description: "Failed to load agent versions.",
            variant: "destructive",
          });
        });
    } else {
      setAgentVersions([]);
    }
  }, [activeAgent?.id, toast]);

  // Determine if interactions should be disabled (e.g., agent is inactive or updating status)
  const interactionsDisabled =
    !activeAgent ||
    activeAgent.is_active === false ||
    isAgentContextLoading ||
    isSavingDraft ||
    isPublishing ||
    isRollingBack;

  if (isAgentContextLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading agent...</p>
      </div>
    );
  }

  if (agentContextError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <p>Error loading agent: {agentContextError.message}</p>
        <p className="text-muted-foreground text-sm">Please try again later.</p>
      </div>
    );
  }

  if (!activeAgent) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Please select an agent to begin, or create a new one.</p>
      </div>
    );
  }

  // --- Handlers for Versioning Actions ---

  const handleSaveDraft = async () => {
    if (!activeAgent) return;
    setIsSavingDraft(true);
    try {
      const payload = {
        system_prompt: activeAgent.system_prompt,
        rules_jsonb: activeAgent.rules_jsonb,
      };
      await createDraftVersion(activeAgent.id, payload);
      await refreshAgents();
      toast({ title: "Success", description: "Agent draft saved successfully!" });
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save agent draft.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (!activeAgent) return;
    setIsPublishing(true);
    try {
      await publishDraft(activeAgent.id);
      await refreshAgents();
      toast({ title: "Success", description: "Agent published successfully!" });
      setIsPublishConfirmationOpen(false);
    } catch (error: any) {
      console.error("Error publishing agent:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to publish agent.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRollback = async () => {
    if (!activeAgent || !selectedRollbackVersionId) return;
    setIsRollingBack(true);
    try {
      await rollbackAgent(activeAgent.id, selectedRollbackVersionId);
      await refreshAgents();
      toast({ title: "Success", description: "Agent rolled back successfully!" });
      setIsRollbackConfirmationOpen(false);
      setSelectedRollbackVersionId(null);
    } catch (error: any) {
      console.error("Error rolling back agent:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to roll back agent.",
        variant: "destructive",
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  // Check if current agent has a draft
  const hasDraft = activeAgent?.draft_version_id !== null;
  // Check if current agent has a published version
  const hasPublished = activeAgent?.published_version_id !== null;

  return (
    <div ref={containerRef} className="relative w-full p-6">
      {!activeAgent?.is_active && (
        <div className="mb-4 rounded-lg bg-orange-100 border border-orange-300 text-orange-800 px-4 py-2 text-sm flex items-center justify-center gap-2">
          <Info className="h-4 w-4" />
          This agent is currently disabled. Interactions are blocked.
        </div>
      )}

      {/* Agent Versioning Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold text-foreground">{activeAgent?.name}</h1>
          {hasDraft && <Badge variant="outline">Draft</Badge>}
          {hasPublished && (
            <Badge className="bg-green-500 hover:bg-green-500 text-white">
              Published (v{agentVersions.find(v => v.id === activeAgent?.published_version_id)?.version_number || 'N/A'})
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={interactionsDisabled || isSavingDraft}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavingDraft ? "Saving Draft..." : "Save Draft"}
          </Button>
          <Button
            variant="default"
            onClick={() => setIsPublishConfirmationOpen(true)}
            disabled={interactionsDisabled || isPublishing || !hasDraft}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={interactionsDisabled || isRollingBack || agentVersions.length <= 1}
              >
                <History className="mr-2 h-4 w-4" />
                Rollback
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {agentVersions.filter(v => v.id !== activeAgent?.published_version_id).map((version) => (
                <DropdownMenuItem
                  key={version.id}
                  onSelect={() => {
                    setSelectedRollbackVersionId(version.id);
                    setIsRollbackConfirmationOpen(true);
                  }}
                  disabled={interactionsDisabled}
                >
                  Version {version.version_number} (
                  {new Date(version.created_at).toLocaleString()})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="flex-1 overflow-y-auto pt-4">
          <div className="space-y-4">
            {" "}
            {/* Added space-y-4 for consistent spacing */}
            <AgentSettings activeAgent={activeAgent} interactionsDisabled={interactionsDisabled} />
            <AgentKnowledge agentId={activeAgent.id} interactionsDisabled={interactionsDisabled} />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="flex-1 pt-4">
          {" "}
          {/* Removed overflow-y-auto as Playground handles its own scroll */}
          <AgentPlayground agentId={activeAgent.id} mode="preview" interactionsDisabled={interactionsDisabled} />
        </TabsContent>
      </Tabs>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={isPublishConfirmationOpen} onOpenChange={setIsPublishConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Publish</AlertDialogTitle>
            <AlertDialogDescription>
              This will make the current draft version live for all channels. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={isRollbackConfirmationOpen} onOpenChange={setIsRollbackConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert the live agent to{" "}
              <span className="font-semibold">
                Version{" "}
                {
                  agentVersions.find((v) => v.id === selectedRollbackVersionId)
                    ?.version_number
                }
              </span>{" "}
              published on{" "}
              <span className="font-semibold">
                {new Date(
                  agentVersions.find((v) => v.id === selectedRollbackVersionId)?.created_at || ""
                ).toLocaleString()}
              </span>
              . Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={isRollingBack}>
              {isRollingBack ? "Rolling Back..." : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

