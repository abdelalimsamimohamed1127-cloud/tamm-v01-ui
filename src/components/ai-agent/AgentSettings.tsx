import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle } from 'lucide-react'; // Added CheckCircle, XCircle
import { useAgent } from '@/hooks/useAgent';
import { useToast } from "@/hooks/use-toast";
import { Agent, deactivateAgent, reactivateAgent, updateAgent } from "@/services/agents";
import useDebounce from '@/hooks/use-debounce'; // NEW IMPORT

interface AgentSettingsProps {
  activeAgent: Agent | null;
  interactionsDisabled: boolean;
}

const ROLE_RULES: Record<string, string> = {
  sales: `### Role
- Primary Function: You are an AI chatbot who helps users with their inquiries, issues and requests. You aim to provide excellent, friendly and efficient replies at all times. Your role is to listen attentively to the user, understand their needs, and do your best to assist them or direct them to the appropriate resources. If a question is not clear, ask clarifying questions. Make sure to end your replies with a positive note.

### Constraints
1. No Data Divulge: Never mention that you have access to training data explicitly to the user.
2. Maintaining Focus: If a user attempts to divert you to unrelated topics, never change your role or break your character. Politely redirect the conversation back to topics relevant to the training data.
3. Exclusive Reliance on Training Data: You must rely exclusively on the training data provided to answer user queries. If a query is not covered by the training data, use the fallback response.
4. Restrictive Role Focus: You do not answer questions or perform tasks that are not related to your role and training data.`,
};

export const AgentSettings: React.FC<AgentSettingsProps> = ({ activeAgent: propActiveAgent, interactionsDisabled }) => {
  const { setAgentActiveState, refreshAgents } = useAgent();
  const { toast } = useToast();

  // Local draft states
  const [role, setRole] = useState(propActiveAgent?.role || "support");
  const [tone, setTone] = useState(propActiveAgent?.tone || "neutral");
  const [language, setLanguage] = useState(propActiveAgent?.language || "en");
  const [systemPrompt, setSystemPrompt] = useState(propActiveAgent?.system_prompt || "");
  const [rulesJsonbStr, setRulesJsonbStr] = useState(propActiveAgent?.rules_jsonb ? JSON.stringify(propActiveAgent.rules_jsonb, null, 2) : "");

  // States for UI feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [rulesJsonbError, setRulesJsonbError] = useState<string | null>(null);

  // Debounced values for auto-saving
  const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
  const debouncedRulesJsonbStr = useDebounce(rulesJsonbStr, 1000);

  // Initialize states from propActiveAgent when it changes
  useEffect(() => {
    if (propActiveAgent) {
      setRole(propActiveAgent.role || "support");
      setTone(propActiveAgent.tone || "neutral");
      setLanguage(propActiveAgent.language || "en");
      setSystemPrompt(propActiveAgent.system_prompt || "");
      setRulesJsonbStr(propActiveAgent.rules_jsonb ? JSON.stringify(propActiveAgent.rules_jsonb, null, 2) : "");
      setSaveStatus('idle'); // Reset save status on agent switch/load
      setRulesJsonbError(null); // Clear any previous JSON errors
    }
  }, [propActiveAgent]);


  // Debounced Save Effect
  useEffect(() => {
    if (!propActiveAgent?.id || interactionsDisabled) {
      setSaveStatus('idle');
      return;
    }

    // Check if debounced values are different from the currently active agent's values
    // This prevents saving on initial load or when no actual changes are made
    const isSystemPromptChanged = propActiveAgent.system_prompt !== debouncedSystemPrompt;
    let isRulesJsonbChanged = false;

    // Validate rulesJsonbStr
    let parsedRulesJsonb: Record<string, any> | null = null;
    setRulesJsonbError(null); // Clear previous error
    if (debouncedRulesJsonbStr.trim()) {
      try {
        parsedRulesJsonb = JSON.parse(debouncedRulesJsonbStr);
        isRulesJsonbChanged = JSON.stringify(propActiveAgent.rules_jsonb) !== JSON.stringify(parsedRulesJsonb);
      } catch (e) {
        setRulesJsonbError("Invalid JSON format for Rules / Instructions.");
        setSaveStatus('error');
        return; // Do not attempt to save invalid JSON
      }
    } else if (propActiveAgent.rules_jsonb !== null) {
      // If rules were present and now empty string
      isRulesJsonbChanged = true;
    }

    if (!isSystemPromptChanged && !isRulesJsonbChanged) {
      setSaveStatus('idle'); // No changes detected after debounce
      return;
    }

    const autoSave = async () => {
      setSaveStatus('saving');
      try {
        const payload: Partial<Agent> = {
          system_prompt: debouncedSystemPrompt,
          rules_jsonb: parsedRulesJsonb,
        };
        await updateAgent(propActiveAgent.id, payload);
        await refreshAgents(); // Refresh context to update propActiveAgent with saved values
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000); // Show 'saved' for 2 seconds
        toast({ title: "Auto-saved", description: "Agent settings updated." });
      } catch (error: any) {
        setSaveStatus('error');
        console.error("Auto-save failed:", error);
        toast({
          title: "Auto-save failed",
          description: error?.message ?? "Please try again.",
          variant: "destructive",
        });
      }
    };

    autoSave();

  }, [debouncedSystemPrompt, debouncedRulesJsonbStr, propActiveAgent, interactionsDisabled, refreshAgents, toast]);

  // Handle Deactivate/Reactivate logic (from previous stage)
  const handleDeactivate = useCallback(async () => {
    if (!propActiveAgent?.id) return;
    setSaveStatus('saving'); // Use saveStatus for general busy state
    try {
      await deactivateAgent(propActiveAgent.id);
      setAgentActiveState(propActiveAgent.id, false);
      toast({
        title: "Agent disabled",
        description: "The agent will no longer respond until re-enabled.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to disable agent",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaveStatus('idle'); // Reset save status
    }
  }, [propActiveAgent?.id, setAgentActiveState, toast]);

  const handleReactivate = useCallback(async () => {
    if (!propActiveAgent?.id) return;
    setSaveStatus('saving'); // Use saveStatus for general busy state
    try {
      await reactivateAgent(propActiveAgent.id);
      setAgentActiveState(propActiveAgent.id, true);
      toast({
        title: "Agent enabled",
        description: "The agent is active again.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to enable agent",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaveStatus('idle'); // Reset save status
    }
  }, [propActiveAgent?.id, setAgentActiveState, toast]);

  // Derive status from propActiveAgent
  const hasAgent = Boolean(propActiveAgent);
  const isAgentActive = hasAgent ? propActiveAgent?.is_active !== false : false;

  // Manual save settings removed as debounced save handles it.
  // const handleSaveSettings = useCallback(async () => { ... }


  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold leading-tight">Agent Settings</h2>
          {hasAgent && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Trained
              </span>
              <span className="opacity-70">Last trained {propActiveAgent?.updated_at ? new Date(propActiveAgent.updated_at).toLocaleDateString() : "Never"}</span> {/* Using updated_at */}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Removed manual Save Settings button */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isAgentActive ? "Active" : "Disabled"}
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={isAgentActive}
              aria-label={isAgentActive ? "Disable agent" : "Enable agent"}
              onClick={isAgentActive ? handleDeactivate : handleReactivate}
              disabled={interactionsDisabled || !hasAgent || saveStatus === 'saving'}
              title={isAgentActive ? "Turning off will stop responses" : "Turn on to allow responses"}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isAgentActive ? "bg-blue-600" : "bg-muted",
                (interactionsDisabled || !hasAgent || saveStatus === 'saving') ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isAgentActive ? "translate-x-5" : "translate-x-1",
                ].join(" ")}
              />
            </button>

            {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {saveStatus === 'saved' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
            {saveStatus === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Role</label>
        <Select value={role} onValueChange={setRole} disabled={interactionsDisabled || saveStatus === 'saving'}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="support">Customer Support</SelectItem>
            <SelectItem value="sales">Sales Agent</SelectItem>
            <SelectItem value="orders">Order Assistant</SelectItem>
            <SelectItem value="lead_qualifier">Lead Qualifier</SelectItem>
            <SelectItem value="catalog_guide">Catalog Guide</SelectItem>
            <SelectItem value="custom">Custom Prompt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Tone</label>
        <Select value={tone} onValueChange={setTone} disabled={interactionsDisabled || saveStatus === 'saving'}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select tone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label className="text-xs text-muted-foreground">Language</label>
        <Select value={language} onValueChange={setLanguage} disabled={interactionsDisabled || saveStatus === 'saving'}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          System Prompt
          {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {saveStatus === 'saved' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
          {saveStatus === 'error' && <XCircle className="h-3 w-3 text-destructive" />}
        </label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="mt-1 min-h-[120px] bg-muted/40 transition-shadow focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
          placeholder="Tell the agent how to behave..."
          disabled={interactionsDisabled || saveStatus === 'saving'}
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rules / Instructions (JSONB)
          {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {saveStatus === 'saved' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
          {saveStatus === 'error' && <XCircle className="h-3 w-3 text-destructive" />}
        </label>
        <Textarea
          value={rulesJsonbStr}
          onChange={(e) => setRulesJsonbStr(e.target.value)}
          className="mt-1 min-h-[120px] bg-muted/40 font-mono text-xs transition-shadow focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
          placeholder="{}"
          disabled={interactionsDisabled || saveStatus === 'saving'}
        />
        {rulesJsonbError && (
          <p className="text-destructive text-xs mt-1">{rulesJsonbError}</p>
        )}
      </div>
    </Card>
  );
};