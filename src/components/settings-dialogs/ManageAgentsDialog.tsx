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
  PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WorkspaceSettingsPanel } from './WorkspaceSettingsPanel';
import { WorkspaceSelectorDropdown } from './WorkspaceSelectorDropdown';
import { CreateAgentForm } from './CreateAgentForm';

// --- Types ---
type ViewState = 'agents' | 'usage' | 'settings-general' | 'settings-members' | 'settings-plans' | 'settings-billing' | 'create-agent';
type SettingsTab = 'general' | 'members' | 'plans' | 'billing';

// --- Mock Data ---
const AGENTS = [
  { id: 1, name: 'Support Bot Alpha', trained: '2 hours ago', status: 'active' },
  { id: 2, name: 'Sales Assistant', trained: '1 day ago', status: 'active' },
  { id: 3, name: 'Internal HR Helper', trained: '3 days ago', status: 'paused' },
  { id: 4, name: 'Legacy Bot v1', trained: '1 week ago', status: 'inactive' },
  { id: 5, name: 'Onboarding Guide', trained: '2 weeks ago', status: 'active' },
];

// --- Components ---

/**
 * Sub-Component: Agents List View
 */
const AgentsList = ({ setActiveSection }: { setActiveSection: (section: ViewState) => void }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button variant="primary" onClick={() => setActiveSection('create-agent')}>
          <PlusCircle className="h-4 w-4 mr-2" />
          New AI Agent
        </Button>
      </div>
      {AGENTS.map((agent) => (
        <Card key={agent.id} className="flex items-center justify-between p-4 transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-4">
            {/* Soft graphic placeholder */}
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">{agent.name}</h4>
              <p className="text-sm text-muted-foreground">Last trained: {agent.trained}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </Button>
        </Card>
      ))}
    </div>
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
      default: return 'Settings';
    }
  };

  return (
    // Overlay
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-5xl h-[85vh] bg-card rounded-lg shadow-lg flex overflow-hidden border border-border">
        
        {/* Close Button */}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 p-2 rounded-md bg-card/80 hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 1️⃣ Left Sidebar */}
        <div className="w-64 flex-shrink-0 bg-sidebar border-r border-border flex flex-col">
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
          <div className="flex items-center justify-between p-6 border-b border-border bg-card/95 backdrop-blur-sm">
            <WorkspaceSelectorDropdown />
            <h1 className="text-xl font-bold text-foreground">{getMainContentTitle()}</h1>
          </div>
          
          {/* Scrollable Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-4xl mx-auto">
              
              {/* Conditional Content Rendering */}
              {activeSection === 'agents' && (
                <div className="space-y-6">
                  <div className="mt-6">
                    <AgentsList setActiveSection={setActiveSection} />
                  </div>
                </div>
              )}
              {activeSection === 'usage' && (
                <div className="space-y-6">
                  <div className="mt-6">
                    <UsageAnalytics />
                  </div>
                </div>
              )}
              {(activeSection.startsWith('settings-')) && (
                <div className="space-y-6">
                  <WorkspaceSettingsPanel activeSettingTab={activeSection.replace('settings-', '') as SettingsTab} />
                </div>
              )}
              {activeSection === 'create-agent' && (
                <div className="space-y-6">
                  <div className="mt-6">
                    <CreateAgentForm setActiveSection={setActiveSection} />
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