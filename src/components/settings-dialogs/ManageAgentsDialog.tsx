import { useState } from 'react';
import {
  X,
  Users,
  BarChart3,
  Settings,
  MoreHorizontal,
  Calendar,
  Filter,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WorkspaceSettingsPanel } from './WorkspaceSettingsPanel';
import { WorkspaceSelectorDropdown } from './WorkspaceSelectorDropdown';
import { CreateAgentForm } from './CreateAgentForm';
import { useAgent } from '@/hooks/useAgent';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Agent, updateAgent, deleteAgent } from '@/services/agents';
import { useWorkspace } from '@/hooks';
import { useToast } from '@/hooks/use-toast';
// --- Types ---
type ViewState = 'agents' | 'usage' | 'settings-general' | 'settings-members' | 'settings-plans' | 'settings-billing' | 'create-agent';
type SettingsTab = 'general' | 'members' | 'plans' | 'billing';



// --- Components ---

/**
 * Sub-Component: Agents List View
 */
const AgentsList = ({ setActiveSection, onClose }: { setActiveSection: (section: ViewState) => void, onClose: () => void }) => {
  const { activeWorkspace } = useWorkspace();
  const { agents, setAgent, refreshAgents, activeAgent } = useAgent();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAgent = async () => {
    if (!agentToDelete || !activeWorkspace?.id) return;

    if (agents.length === 1) {
      toast({
        title: "Deletion Failed",
        description: "Cannot delete the last agent in a workspace. Create another agent first.",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setAgentToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAgent(agentToDelete.id, activeWorkspace.id);
      toast({
        title: "Agent Deleted",
        description: `Agent "${agentToDelete.name}" has been deleted.`,
      });

      await refreshAgents(); // Refresh the list of agents

      // If the deleted agent was the active one, select a new active agent
      if (activeAgent?.id === agentToDelete.id) {
        const remainingAgents = agents.filter(a => a.id !== agentToDelete.id);
        if (remainingAgents.length > 0) {
          setAgent(remainingAgents[0].id);
        } else {
          setAgent(null);
        }
      }

    } catch (error: any) {
      console.error("Error deleting agent:", error);
      toast({
        title: "Deletion Error",
        description: error.message || "Failed to delete agent.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  const handleToggleAgentActive = async (agent: Agent) => {
    if (!activeWorkspace?.id) return;
    try {
      const updated = await updateAgent(agent.id, { is_active: !agent.is_active });
      toast({
        title: "Agent Status Updated",
        description: `Agent "${updated.name}" is now ${updated.is_active ? 'active' : 'inactive'}.`,
      });
      await refreshAgents();
    } catch (error: any) {
      console.error("Error toggling agent active state:", error);
      toast({
        title: "Update Error",
        description: error.message || "Failed to update agent status.",
        variant: "destructive",
      });
    }
  };

  const handleSelectAgent = (agentId: string) => {
    setAgent(agentId);
    onClose();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end mb-4">
          <Button variant="primary" onClick={() => setActiveSection('create-agent')}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New AI Agent
          </Button>
        </div>
        {agents.length === 0 ? (
          <p className="text-center text-muted-foreground">No agents found for this workspace.</p>
        ) : (
          agents.map((agent) => (
            <Card
              key={agent.id}
              className="flex items-center justify-between p-4 transition-all duration-200 hover:shadow-md"
            >
              <div
                className="flex items-center gap-4 flex-grow cursor-pointer"
                onClick={() => handleSelectAgent(agent.id)}
              >
                {/* Soft graphic placeholder */}
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">{agent.name}</h4>
                  {agent.description && <p className="text-sm text-muted-foreground truncate max-w-[200px]">{agent.description}</p>}
                  <p className="text-xs text-muted-foreground">Status: {agent.status}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`active-status-${agent.id}`}
                    checked={agent.is_active || false}
                    onCheckedChange={() => handleToggleAgentActive(agent)}
                    onClick={(e) => e.stopPropagation()} // Prevent card click from firing
                  />
                  <Label htmlFor={`active-status-${agent.id}`} className="sr-only">Toggle Active</Label>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        // Implement edit functionality or navigate to agent settings page
                        // For now, this is a placeholder. Renaming is often done in a dedicated settings view.
                        toast({
                          title: "Edit Agent",
                          description: "Edit functionality for agents is under development.",
                        });
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setAgentToDelete(agent);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete agent "{agentToDelete?.name}"
              and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAgent} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
/**
 * Sub-Component: Usage Analytics View
 */
const UsageAnalytics = () => {
  return (
    <div className="space-y-6">
      {/* Filter Bar - Inline layout */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select className="h-10 min-w-[160px] appearance-none rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option>All Agents</option>
            <option>Support Bot Alpha</option>
            <option>Sales Assistant</option>
          </select>
        </div>
        
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select className="h-10 min-w-[160px] appearance-none rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
          </select>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/50 border-dashed">
          <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm">Message Volume Chart</span>
        </Card>
        <Card className="p-6 h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/50 border-dashed">
          <div className="h-8 w-8 rounded-full border-2 border-border mb-2 opacity-50" />
          <span className="text-sm">Token Usage Stats</span>
        </Card>
      </div>
    </div>
  );
};

/**
 * Main Component: Manage Agents Dialog
 */
export default function ManageAgentsDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
}) {
  const [activeSection, setActiveSection] = useState<ViewState>('agents');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  if (!open) return null;

  // Determine the title for the main content area
  const getMainContentTitle = () => {
    switch (activeSection) {
      case 'agents': return 'Manage Agents';
      case 'usage': return 'Usage Analytics';
      case 'settings-general': return 'General Settings';
      case 'settings-members': return 'Members';
      case 'settings-plans': return 'Plans';
      case 'settings-billing': return 'Billing';
      case 'create-agent': return 'Create New AI Agent'; // Add title for create-agent view
      default: return 'Settings';
    }
  };

  return (
    // Overlay
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-5xl h-full sm:h-[85vh] bg-card rounded-lg shadow-lg flex overflow-hidden border border-border">
        
        {/* Close Button */}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 p-2 rounded-md bg-card/80 hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 1️⃣ Left Sidebar */}
        <div className="hidden sm:flex w-64 flex-shrink-0 bg-sidebar border-r border-border flex-col">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground">Settings</h3>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            <button
              onClick={() => setActiveSection('agents')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                activeSection === 'agents' 
                  ? "bg-accent text-primary shadow-sm" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Users className="h-4 w-4" />
              Agents
            </button>
            
            <button
              onClick={() => setActiveSection('usage')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                activeSection === 'usage' 
                  ? "bg-accent text-primary shadow-sm" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Usage
            </button>

            <div className="my-4 px-3">
              <div className="h-[1px] bg-border" />
            </div>

            {/* Workspace Settings (collapsible) */}
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                (activeSection.startsWith('settings-') || isSettingsExpanded)
                  ? "text-foreground" 
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                Workspace settings
              </div>
              {isSettingsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isSettingsExpanded && (
              <div className="ml-4 pl-3 border-l border-border space-y-1">
                {['general', 'members', 'plans', 'billing'].map((settingKey) => (
                  <button
                    key={settingKey}
                    onClick={() => setActiveSection(`settings-${settingKey}` as ViewState)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm transition-colors relative",
                      activeSection === `settings-${settingKey}`
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {activeSection === `settings-${settingKey}` && (
                      <div className="absolute left-[-17px] top-0 bottom-0 w-[2px] bg-primary" />
                    )}
                    {settingKey.charAt(0).toUpperCase() + settingKey.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* 2️⃣ Right Main Content Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Fixed Header for Right Panel */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm sm:p-6">
            <h1 className="text-xl font-bold text-foreground hidden sm:block">{getMainContentTitle()}</h1> {/* Hide on mobile */}
            
            {/* Mobile View Selector */}
            <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as ViewState)}
                className="block sm:hidden h-10 w-full appearance-none rounded-md border border-border bg-card pl-3 pr-8 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
                <option value="agents">Agents</option>
                <option value="usage">Usage</option>
                <option value="settings-general">General Settings</option>
                <option value="settings-members">Members</option>
                <option value="settings-plans">Plans</option>
                <option value="settings-billing">Billing</option>
                <option value="create-agent">Create New AI Agent</option>
            </select>
            <WorkspaceSelectorDropdown /> {/* Keep on desktop, but make responsive */}
          </div>
          
          {/* Scrollable Area */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-4 max-w-4xl mx-auto sm:p-8 flex-1 flex flex-col">
              
              {/* Conditional Content Rendering */}
              {activeSection === 'agents' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="mt-6 flex-1 flex flex-col">
                    <AgentsList setActiveSection={setActiveSection} onClose={() => onOpenChange(false)} />
                  </div>
                </div>
              )}
              {activeSection === 'usage' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="mt-6 flex-1 flex flex-col">
                    <UsageAnalytics />
                  </div>
                </div>
              )}
              {(activeSection.startsWith('settings-')) && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <WorkspaceSettingsPanel activeSettingTab={activeSection.replace('settings-', '') as SettingsTab} />
                </div>
              )}
              {activeSection === 'create-agent' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="mt-6 flex-1 flex flex-col">
                    <CreateAgentForm setActiveSection={setActiveSection} onClose={() => onOpenChange(false)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}