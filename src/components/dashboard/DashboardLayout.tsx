import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/dashboard/overview' },
  { key: 'channels', icon: Radio, path: '/dashboard/channels' },
  { key: 'agent', icon: Bot, path: '/dashboard/ai-agent' },
  { key: 'inbox', icon: Inbox, path: '/dashboard/inbox' },
  { key: 'orders', icon: ShoppingCart, path: '/dashboard/orders' },
  { key: 'tickets', icon: LifeBuoy, path: '/dashboard/tickets' },
  { key: 'automations', icon: Workflow, path: '/dashboard/automations' },
  { key: 'evals', icon: ClipboardList, path: '/dashboard/evals' },
  { key: 'insights', icon: Sparkles, path: '/dashboard/insights' },
  { key: 'analytics', icon: BarChart3, path: '/dashboard/analytics' },
  { key: 'settings', icon: Settings, path: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  const NavContent = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.key}
          to={item.path}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            isActive(item.path)
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
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex" dir={dir}>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        className={cn(
          'hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border',
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

        {/* Agent Status */}
        <div className="px-3 pb-4">
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
                'fixed top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 lg:hidden flex flex-col',
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
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
