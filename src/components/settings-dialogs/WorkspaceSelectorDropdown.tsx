import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Workspace {
  id: string;
  name: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  active: boolean;
}

const MOCK_WORKSPACES: Workspace[] = [
  { id: '1', name: 'My Main Workspace', plan: 'Pro', active: true },
  { id: '2', name: 'Project Alpha Team', plan: 'Free', active: false },
  { id: '3', name: 'Client X Solutions', plan: 'Enterprise', active: false },
  { id: '4', name: 'Dev Sandbox', plan: 'Free', active: false },
];

export const WorkspaceSelectorDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeWorkspace = MOCK_WORKSPACES.find(ws => ws.active);

  const filteredWorkspaces = MOCK_WORKSPACES.filter(ws =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="flex items-center gap-1.5 h-auto py-1 px-2 text-left justify-start"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col items-start leading-none">
          <span className="text-sm font-medium text-foreground">{activeWorkspace?.name || 'Select Workspace'}</span>
          <span className="text-xs text-muted-foreground">{activeWorkspace?.plan || 'N/A'} Plan</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
      </Button>

      {isOpen && (
        <Card className="absolute left-0 top-full mt-2 w-72 p-2 z-50">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workspaces..."
              className="flex h-9 w-full rounded-md border border-border bg-input py-1 pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredWorkspaces.map(ws => (
              <Button
                key={ws.id}
                variant="ghost"
                className={cn(
                  "w-full flex justify-between items-center text-sm px-3 py-2",
                  ws.active ? "bg-accent text-foreground" : "hover:bg-accent"
                )}
                // onClick={() => handleWorkspaceSelect(ws.id)} // No logic change
              >
                <div className="flex flex-col items-start leading-none">
                  <span className="font-medium">{ws.name}</span>
                  <span className="text-xs text-muted-foreground">{ws.plan} Plan</span>
                </div>
                {ws.active && <Check className="h-4 w-4 text-success" />}
              </Button>
            ))}
          </div>

          <div className="border-t border-border pt-2 mt-2">
            <Button
              variant="ghost"
              className="w-full flex justify-start items-center gap-2 text-sm px-3 py-2 text-primary hover:bg-primary/10"
              // onClick={handleCreateOrJoinWorkspace} // No logic change
            >
              <PlusCircle className="h-4 w-4" />
              Create or join workspace
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
