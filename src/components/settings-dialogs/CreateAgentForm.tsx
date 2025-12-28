import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { ViewState } from './ManageAgentsDialog';
import { useWorkspace } from '@/hooks';
import { useAgent } from '@/hooks/useAgent';
import { useToast } from '@/hooks/use-toast'; // Corrected import
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getAgentTemplates, AgentTemplate } from '@/services/agentTemplates';
import { createAgent } from '@/services/agents'; // NEW IMPORT

export const CreateAgentForm = ({ setActiveSection, onClose }: { setActiveSection: (section: ViewState) => void, onClose: () => void }) => {
  const { activeWorkspace } = useWorkspace();
  const { refreshAgents, setAgent } = useAgent();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsTemplatesLoading(true);
      try {
        const fetchedTemplates = await getAgentTemplates();
        setTemplates(fetchedTemplates);
      } catch (error) {
        console.error("Error fetching agent templates:", error);
        toast({
          title: "Error",
          description: "Failed to load agent templates.",
          variant: "destructive",
        });
      } finally {
        setIsTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, [toast]);

  // Effect to prefill fields when template changes
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== "blank") {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        // Prefill description from template, if available
        if (template.description) {
          setDescription(template.description);
        }
      }
    } else {
      // If "Blank agent" or no template selected, clear description
      setDescription('');
    }
  }, [selectedTemplateId, templates]);

  const handleCreateAgent = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Agent name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!activeWorkspace?.id) {
      toast({
        title: "Error",
        description: "No active workspace selected.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let agentConfig = {};
      if (selectedTemplateId && selectedTemplateId !== "blank") {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          agentConfig = template.config_jsonb || {};
        }
      }

      const newAgentPayload = {
        name: name.trim(),
        workspace_id: activeWorkspace.id,
        description: description.trim() || undefined, // Use undefined for optional fields to avoid sending empty string
        status: 'draft', // Default status for new agents, can be set to 'active' if desired
        system_prompt: agentConfig.system_prompt || "You are a helpful AI assistant.",
        role: agentConfig.role || "support",
        tone: agentConfig.tone || "neutral",
        language: agentConfig.language || "en",
        rules_jsonb: agentConfig.rules || [],
      };

      const newAgent = await createAgent(newAgentPayload);

      // Context Sync
      await refreshAgents();
      setAgent(newAgent.id);

      // UI Feedback
      toast({
        title: "Success",
        description: `Agent "${newAgent.name}" created successfully!`,
      });
      onClose();
      setActiveSection('agents');
      setName('');
      setDescription('');
      setSelectedTemplateId(null);

    } catch (error: any) {
      console.error("Error creating agent:", error.message);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while creating the agent.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveSection('agents')} className="text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <CardTitle className="text-foreground">Create New AI Agent</CardTitle>
            <CardDescription className="text-muted-foreground">Add a new AI agent with a name and optional description.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
            <Label htmlFor="agent-template">Start from Template</Label>
            <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || "blank"} disabled={isLoading || isTemplatesLoading}>
                <SelectTrigger id="agent-template" className="w-full">
                    <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="blank">Blank Agent</SelectItem>
                    {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {isTemplatesLoading && <p className="text-xs text-muted-foreground">Loading templates...</p>}
        </div>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              placeholder="My AI Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-border focus-visible:ring-ring bg-input text-foreground"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-description">Description (Optional)</Label>
            <Input
              id="agent-description"
              placeholder="What does this agent do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-border focus-visible:ring-ring bg-input text-foreground"
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCreateAgent} disabled={isLoading || !name.trim()}>
            {isLoading ? "Creating..." : "Create Agent"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
