// src/contexts/WorkspaceContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Workspace } from '@/types/primitives';

// --- Type Definitions ---

interface WorkspaceContextValue {
  workspaceId: string | null;
  workspaces: Workspace[];
  setWorkspace: (id: string) => void;
  isLoading: boolean;
  activeWorkspace: Workspace | null;
}

// --- Context Definition ---

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);


// --- Provider Component ---

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('activeWorkspaceId');
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch workspaces on initial load
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('workspaces').select('*');

      if (error) {
        console.error("Error fetching workspaces:", error);
        setWorkspaces([]);
      } else {
        setWorkspaces(data as Workspace[]);
        // If no workspace is selected, or the selected one doesn't exist, default to the first one.
        if (!workspaceId || !data.some(w => w.id === workspaceId)) {
          const firstWorkspaceId = data[0]?.id || null;
          setWorkspace(firstWorkspaceId);
        }
      }
      setIsLoading(false);
    };

    fetchWorkspaces();
  }, []);

  const setWorkspace = (id: string | null) => {
    if (id) {
      localStorage.setItem('activeWorkspaceId', id);
    } else {
      localStorage.removeItem('activeWorkspaceId');
    }
    // As per requirements, clear the active agent when workspace changes.
    // The key is scoped by workspace to handle multiple workspaces.
    if (workspaceId) {
        localStorage.removeItem(`activeAgentId_${workspaceId}`);
    }
    localStorage.removeItem('activeAgentId'); // Also clear the generic one just in case
    
    setWorkspaceIdState(id);
    
    // In a real app with React Query or SWR, you'd invalidate queries here.
    // queryClient.invalidateQueries();
    console.log("Workspace changed, related queries should be invalidated.");
  };
  
  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === workspaceId) || null;
  }, [workspaceId, workspaces]);


  const value: WorkspaceContextValue = {
    workspaceId,
    workspaces,
    setWorkspace,
    isLoading,
    activeWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// --- Hook for consuming the context ---

export const useWorkspaces = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaces must be used within a WorkspaceProvider');
  }
  return context;
};
