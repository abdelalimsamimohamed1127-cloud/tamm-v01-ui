import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext'; // New import
import { useWorkspace } from '@/hooks/useWorkspace';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from "lucide-react";
import { AgentProvider } from '@/contexts/AgentContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext' // New import
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher' // New import
import { AgentSwitcher } from '@/components/agent/AgentSwitcher' // New import

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Bot,
  Inbox,
  BarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sparkles,
  Menu,
  ChevronDown,
  BadgePlus,
  CheckCircle2,
  Lightbulb,
  FileText,
  Users2,
  Send,
  Cog,
  Workflow
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import AccountDialog from "@/components/settings-dialogs/AccountDialog";
import CreateWorkspaceDialog from "@/components/settings-dialogs/CreateWorkspaceDialog";
import ManageAgentsDialog from "@/components/settings-dialogs/ManageAgentsDialog";

import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type NavChildItem = {
  key: string;
  path: string;
  icon?: LucideIcon;
};

type NavItem = {
  key: string;
  title: string; 
  icon: LucideIcon;
  path?: string;
  children?: NavChildItem[];
};

const navItems: NavItem[] = [
    {
        key: 'playground',
        title: 'Playground',
        icon: Bot,
        path: '/dashboard/ai-agent',
      },
      {
        key: 'channels',
        title: 'Channels',
        icon: FileText,
        path: '/dashboard/channels',
      },
      {
        key: 'activity',
        title: 'Activity',
        icon: Inbox,
        path: '/dashboard/inbox',
      },
      {
        key: 'actions',
        title: 'Actions',
        icon: Workflow,
        path: '/dashboard/automations',
      },
      {
        key: 'analytics',
        title: 'Analytics',
        icon: BarChart,
        children: [
          { key: 'analytics.general', path: '/dashboard/analytics/general', icon: BarChart },
          { key: 'analytics.evals', path: '/dashboard/analytics/evals', icon: CheckCircle2 },
          { key: 'analytics.insights', path: '/dashboard/analytics/insights', icon: Lightbulb },
        ],
      },
      {
        key: 'settings',
        title: 'Settings',
        icon: Cog,
        children: [
          { key: 'settings.general', path: '/dashboard/settings/general', icon: Cog },
          { key: 'settings.security', path: '/dashboard/settings/security', icon: User },
        ],
      },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const { activeWorkspace } = useWorkspaces(); // Use the new context
  const { workspace } = useWorkspace(); // Keep for dropdown label for now

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<"account" | "workspace" | "agents" | "create-workspace" | null>(null);

  type CreditsState = 'normal' | 'warning' | 'blocked';

  const agentCredits = {
    used: 2,
    limit: 50,
    resetDate: 'Renews on May 1',
  };

  const creditsPercent = agentCredits.limit === 0 ? 0 : (agentCredits.used / agentCredits.limit) * 100;
  const creditsState: CreditsState = creditsPercent > 100 ? 'blocked' : creditsPercent >= 70 ? 'warning' : 'normal';
  const creditsStyles: Record<CreditsState, { bar: string; text: string }> = {
    normal: { bar: 'bg-primary', text: 'text-muted-foreground' },
    warning: { bar: 'bg-amber-500', text: 'text-amber-700' },
    blocked: { bar: 'bg-destructive', text: 'text-destructive' },
  };

  const handleSignOut = async () => {
    await signOut();
  };

  useEffect(() => {
    const dialog = searchParams.get("dialog");
    if (dialog) {
      setDialogOpen(dialog as any);
    } else {
      setDialogOpen(null);
    }
  }, [searchParams]);

  const openDialog = (dialog: "account" | "workspace" | "agents" | "create-workspace") => {
    setDialogOpen(dialog);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("dialog", dialog);
      return next;
    });
  };

  const closeDialog = () => {
    setDialogOpen(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("dialog");
      return next;
    });
  };

  const NavContent = () => (
    <nav className="flex-1 px-2 py-4 space-y-2">
      {navItems.map((item) => (
        <NavItemComponent key={item.key} item={item} collapsed={collapsed} />
      ))}
    </nav>
  );
  
  const NavItemComponent = ({ item, collapsed }: { item: NavItem, collapsed: boolean }) => {
      const { t } = useLanguage();
      const location = useLocation();
      const [isExpanded, setIsExpanded] = useState(
          item.children?.some(child => location.pathname.startsWith(child.path)) || false
      );
  
      const isParentActive = item.children?.some(child => location.pathname.startsWith(child.path)) || false;
      const isActive = item.path ? location.pathname.startsWith(item.path) : isParentActive;

      if (item.children) {
          return (
              <div>
                  <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium",
                          isActive ? "text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                  >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <>
                            <span>{item.title}</span>
                            <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isExpanded && "rotate-180")} />
                        </>
                      )}
                  </button>
                  <AnimatePresence>
                      {!collapsed && isExpanded && (
                          <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                          >
                              <div
                                  className={cn(
                                      "pt-2 space-y-1",
                                      "border-sidebar-accent",
                                      isParentActive ? "border-primary" : "border-sidebar-accent",
                                      dir === 'rtl' ? 'mr-3 pr-3 border-r' : 'ml-3 pl-3 border-l'
                                  )}
                              >
                                  {item.children.map(child => (
                                      <Link
                                          key={child.key}
                                          to={child.path}
                                          className={cn(
                                              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-normal transition-colors duration-200",
                                              location.pathname.startsWith(child.path)
                                                  ? "bg-primary/10 text-primary font-medium"
                                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                          )}
                                      >
                                          {child.icon && <child.icon className="h-4 w-4" />}
                                          <span>{
                                            (child.key.split('.').pop() || '')
                                              .replace(/_/g, ' ')
                                              .replace(/\b\w/g, l => l.toUpperCase())
                                          }</span>
                                      </Link>
                                  ))}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          );
      }
  
      return (
          <Link
              to={item.path!}
              className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
          >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
          </Link>
      );
  };

  return (
    <WorkspaceProvider> {/* Wrap with WorkspaceProvider */}
      <AgentProvider> {/* AgentProvider is already here */}
        <div className="min-h-screen bg-background flex" dir={dir}>
          {/* Desktop Sidebar */}
          <motion.aside
            initial={false}
            animate={{ width: collapsed ? '4.5rem' : '16rem' }}
            className={cn(
              'hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border h-screen',
              dir === 'rtl' ? 'border-l border-r-0' : ''
            )}
          >
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border flex-shrink-0">
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center">
                    <img src="/tamm.svg" alt="Tamm" className="h-8" />
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
            <div className="px-3 pb-4 mt-auto flex-shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-lg border bg-card text-card-foreground p-3 space-y-3">
                        <div className={cn("flex items-center justify-between", collapsed && "justify-center")}>
                            {!collapsed && <p className="text-xs font-medium text-muted-foreground">Messages</p>}
                            <span className="text-xs font-semibold">
                                {agentCredits.used} / {agentCredits.limit}
                            </span>
                        </div>
                        <Progress
                            value={creditsPercent}
                            className="h-2"
                            indicatorClassName={creditsStyles[creditsState].bar}
                        />
                        {!collapsed &&
                          <Button variant="default" size="sm" className="w-full">
                              Upgrade
                          </Button>
                        }
                    </div>
                  </TooltipTrigger>
                  {collapsed && 
                    <TooltipContent side="right">
                      <p>{agentCredits.used} / {agentCredits.limit} Messages used</p>
                    </TooltipContent>
                  }
                </Tooltip>
              </TooltipProvider>
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
                    <img src="/tamm.svg" alt="Tamm" className="h-8" />
                  </div>
                  <NavContent />
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 h-screen">
            {/* Top Bar */}
            <header className="h-16 bg-background/95 backdrop-blur-sm shrink-0 border-b flex items-center justify-between px-4 lg:px-6">
              {/* Left Group: Mobile Menu, Logo, Workspace/Agent Switchers */}
              <div className="flex items-center gap-3 sm:gap-4"> {/* Adjusted gap for better spacing */}
                {/* Mobile Menu Button - always visible on lg:hidden */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(true)}
                  className="lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                
                

                {/* Workspace and Agent Switchers - responsive stacking */}
                <div className="flex items-center gap-2">
                  <WorkspaceSwitcher onCreateWorkspaceClick={() => openDialog('create-workspace')} />
                  <span className="text-muted-foreground hidden sm:inline">/</span>
                  <AgentSwitcher onCreateAgentClick={() => openDialog('agents')} />
                </div>
              </div>
              
              {/* Right Group: Language Toggle, User Dropdown */}
              <div className="flex items-center gap-3">
                <LanguageToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{user?.email?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal p-3">
                        <p className="text-sm font-semibold truncate">{user?.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {activeWorkspace?.name || 'My Workspace'}
                        </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => openDialog('account')} className="p-3">
                        <User className="h-4 w-4 mr-3 text-muted-foreground" />
                        <span>Account</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onSelect={() => openDialog('agents')} className="p-3">
                        <Users className="h-4 w-4 mr-3 text-muted-foreground" />
                        <span>Manage Agents</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openDialog('create-workspace')} className="p-3">
                      <BadgePlus className="h-4 w-4 mr-3 text-muted-foreground" />
                      <span>Create or Join Workspace</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut} className="text-destructive p-3">
                        <LogOut className="h-4 w-4 mr-3" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
              {children}
            </main>
          </div>


          <AccountDialog open={dialogOpen === 'account'} onOpenChange={closeDialog} />
          <CreateWorkspaceDialog open={dialogOpen === 'create-workspace'} onOpenChange={closeDialog} />
          <ManageAgentsDialog open={dialogOpen === 'agents'} onOpenChange={closeDialog} />
        </div>
      </AgentProvider>
    </WorkspaceProvider>
  );
}
