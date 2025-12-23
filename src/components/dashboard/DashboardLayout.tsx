import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import {
  WorkspaceBillingSettingsCard,
  WorkspaceGeneralSettingsCard,
  WorkspaceMembersSettingsCard,
  WorkspacePlansSettingsCard,
} from "@/components/workspace/WorkspaceSettingsSections";
import { AgentProvider, useAgentContext } from "@/contexts/AgentContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Radio,
  Bot,
  Inbox,
  ShoppingCart,
  LifeBuoy,
  Workflow,
  BarChart3,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sparkles,
  Menu,
  ChevronDown,
  BadgePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { key: 'channels', icon: Radio, path: '/dashboard/channels' },
  { key: 'agent', icon: Bot, path: '/dashboard/ai-agent' },
  { key: 'inbox', icon: Inbox, path: '/dashboard/inbox' },
  { key: 'automations', icon: Workflow, path: '/dashboard/automations' },
  { key: 'evals', icon: ClipboardList, path: '/dashboard/evals' },
  { key: 'insights', icon: Sparkles, path: '/dashboard/insights' },
  { key: 'analytics', icon: BarChart3, path: '/dashboard/analytics' },
  {
    key: 'settings',
    icon: Settings,
    path: '/dashboard/settings/general',
    children: [
      { key: 'settings.general', path: '/dashboard/settings/general' },
      { key: 'settings.security', path: '/dashboard/settings/security' },
    ],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsTab, setWorkspaceSettingsTab] = useState('general');
  const [workspaceCreated, setWorkspaceCreated] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceUrl, setWorkspaceUrl] = useState('');
  const agentCredits = {
    used: 2,
    limit: 50,
    resetDate: 'Renews on May 1',
  };
  const [mobileAgentSheetOpen, setMobileAgentSheetOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname.startsWith(child.path));

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ settings: true });

  const NavContent = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const active = item.path ? isActive(item.path) || isParentActive(item) : isParentActive(item);
        return (
          <div key={item.key} className="space-y-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left',
                  active ? 'bg-primary text-primary-foreground shadow-md' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                    >
                      {t(`dashboard.${item.key}`)}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          expanded[item.key] ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            ) : (
              <Link
                to={item.path!}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive(item.path!)
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {t(`dashboard.${item.key}`)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}

            {hasChildren && expanded[item.key] && (
              <div className={cn('space-y-1', collapsed && 'hidden')}>
                {item.children?.map((child) => (
                  <Link
                    key={child.key}
                    to={child.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'ml-9 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                      isActive(child.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <span className="truncate">{t(`dashboard.${child.key}`)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
  const handleCreateWorkspace = () => {
    // TODO: later wire to real create-workspace flow
    console.log("Create workspace clicked");
  };

  const AgentSwitcher = () => {
    const { currentAgent, agents, setCurrentAgentId } = useAgentContext();
    const agentOptions = (
      <div className="space-y-1">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => {
              setCurrentAgentId(agent.id);
              setMobileAgentSheetOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left",
              agent.id === currentAgent?.id ? "border-primary bg-primary/5" : "hover:bg-muted"
            )}
          >
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agent.name}</p>
              <p className="text-xs text-muted-foreground truncate">ID: {agent.id}</p>
            </div>
          </button>
        ))}
      </div>
    );

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hidden md:flex items-center gap-2 h-9 px-3"
            >
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[140px]">{currentAgent?.name ?? "Select agent"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch agent</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {agentOptions}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="icon"
          className="flex md:hidden h-9 w-9"
          onClick={() => setMobileAgentSheetOpen(true)}
        >
          <Bot className="h-4 w-4" />
        </Button>

        <Dialog open={mobileAgentSheetOpen} onOpenChange={setMobileAgentSheetOpen}>
          <DialogContent className="sm:max-w-md h-[80vh] max-h-screen overflow-hidden p-4">
            <DialogHeader>
              <DialogTitle>Select agent</DialogTitle>
              <DialogDescription>Choose which agent to use.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">{agentOptions}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  return (
    <AgentProvider>
      <div className="min-h-screen bg-slate-50 flex" dir={dir}>
        {/* Desktop Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 72 : 256 }}
          className={cn(
            'hidden lg:flex flex-col bg-slate-100 border-r border-sidebar-border',
            dir === 'rtl' ? 'border-l border-r-0' : ''
          )}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xl font-bold gradient-text">Tamm</span>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              {(collapsed ? (dir === 'rtl' ? ChevronLeft : ChevronRight) : (dir === 'rtl' ? ChevronRight : ChevronLeft)) && (
                collapsed ? 
                  (dir === 'rtl' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : 
                  (dir === 'rtl' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />)
              )}
            </Button>
          </div>

          <NavContent />

          {/* Credits & Agent Status */}
          <div className="px-3 pb-4 space-y-3">
            <div className="rounded-lg border border-sidebar-border bg-background shadow-sm p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Credits</p>
                <span className="text-xs font-semibold">
                  {agentCredits.used} / {agentCredits.limit}
                </span>
              </div>
              {!collapsed && (
                <div className="space-y-2 mt-2">
                  <div className="text-xl font-semibold">
                    {agentCredits.used}
                    <span className="text-sm text-muted-foreground"> / {agentCredits.limit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Reset date: {agentCredits.resetDate}</p>
                  <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                    Upgrade
                  </Button>
                </div>
              )}
            </div>

            <div className={cn(
              'flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg',
              collapsed && 'justify-center'
            )}>
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {!collapsed && (
                <span className="text-xs font-medium text-accent">
                  {t('stats.active')}
                </span>
              )}
            </div>
          </div>
        </motion.aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.aside
                initial={{ x: dir === 'rtl' ? 256 : -256 }}
                animate={{ x: 0 }}
                exit={{ x: dir === 'rtl' ? 256 : -256 }}
                className={cn(
                  'fixed top-0 bottom-0 w-full max-w-xs bg-sidebar border-r border-sidebar-border z-50 lg:hidden flex flex-col shadow-lg',
                  dir === 'rtl' ? 'right-0 border-l border-r-0' : 'left-0'
                )}
              >
                <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
                  <span className="text-xl font-bold gradient-text">Tamm</span>
                </div>
                <NavContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden sm:block">
                <h2 className="text-sm font-medium">{workspace?.name || 'My Workspace'}</h2>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-accent" />
                  <span className="capitalize">{workspace?.plan || 'Free'} Plan</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AgentSwitcher />
              <LanguageToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {workspace?.plan || 'Free'} Plan
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/manage-agents" className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Manage agents
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/account" className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Account settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      // keep menu behavior consistent while opening the dialog
                      e.preventDefault();
                      setWorkspaceDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center">
                      <BadgePlus className="h-4 w-4 mr-2" />
                      Create or join workspace
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setWorkspaceSettingsOpen(true);
                    }}
                  >
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Workspace settings
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
                <DialogTrigger asChild>
                  <span />
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create workspace</DialogTitle>
                    <DialogDescription>
                      Set up a workspace URL to collaborate with your team. This is a preview only.
                    </DialogDescription>
                  </DialogHeader>
                  {!workspaceCreated ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Workspace name</label>
                        <Input
                          value={workspaceName}
                          onChange={(e) => setWorkspaceName(e.target.value)}
                          placeholder="Acme Support"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Workspace URL</label>
                        <Input
                          value={workspaceUrl}
                          onChange={(e) => setWorkspaceUrl(e.target.value)}
                          placeholder="acme"
                        />
                        <p className="text-xs text-muted-foreground">your-workspace.tamm.chat</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border p-3 bg-muted/40">
                      <p className="text-sm font-medium">Workspace created</p>
                      <p className="text-xs text-muted-foreground">
                        You can invite teammates with an invitation code or start configuring channels.
                      </p>
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      disabled={!workspaceName.trim() || !workspaceUrl.trim()}
                      onClick={handleCreateWorkspace}
                    >
                      {workspaceCreated ? 'Continue to dashboard' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={workspaceSettingsOpen} onOpenChange={setWorkspaceSettingsOpen}>
                <DialogTrigger asChild>
                  <span />
                </DialogTrigger>
                <DialogContent
                  className="sm:max-w-5xl w-screen h-screen sm:h-auto sm:w-auto max-h-screen sm:max-h-[85vh] p-0 sm:p-6 overflow-hidden rounded-none sm:rounded-lg left-0 top-0 translate-x-0 translate-y-0 sm:left-1/2 sm:top-1/2 sm:translate-x-[-50%] sm:translate-y-[-50%]"
                  onInteractOutside={(event) => {
                    if (event.defaultPrevented) return;
                  }}
                >
                  <div className="flex h-full flex-col overflow-hidden">
                    <DialogHeader className="px-6 pt-6 sm:px-0 sm:pt-0">
                      <DialogTitle>Workspace settings</DialogTitle>
                      <DialogDescription>
                        Manage workspace details without leaving your current page.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-0 sm:pb-0">
                      <Tabs
                        value={workspaceSettingsTab}
                        onValueChange={setWorkspaceSettingsTab}
                        className="space-y-4 h-full"
                      >
                        <div className="sm:hidden">
                          <Select value={workspaceSettingsTab} onValueChange={setWorkspaceSettingsTab}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="members">Members</SelectItem>
                              <SelectItem value="plans">Plans</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <TabsList className="hidden sm:grid w-full grid-cols-4">
                          <TabsTrigger value="general">General</TabsTrigger>
                          <TabsTrigger value="members">Members</TabsTrigger>
                          <TabsTrigger value="plans">Plans</TabsTrigger>
                          <TabsTrigger value="billing">Billing</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4">
                          <WorkspaceGeneralSettingsCard />
                        </TabsContent>
                        <TabsContent value="members" className="space-y-4">
                          <WorkspaceMembersSettingsCard />
                        </TabsContent>
                        <TabsContent value="plans" className="space-y-4">
                          <WorkspacePlansSettingsCard />
                        </TabsContent>
                        <TabsContent value="billing" className="space-y-4">
                          <WorkspaceBillingSettingsCard />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </AgentProvider>
  );
}
