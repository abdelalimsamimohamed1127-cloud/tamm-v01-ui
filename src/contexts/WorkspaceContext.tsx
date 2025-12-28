// src/contexts/WorkspaceContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react'; // Import useCallback
import { supabase } from '@/lib/supabase';
import { Workspace } from '@/types/primitives';

// --- Type Definitions ---

interface WorkspaceContextValue {
  workspaceId: string | null;
  workspaces: Workspace[];
  setWorkspace: (id: string | null) => void; // Allow null for consistency
  isLoading: boolean;
  activeWorkspace: Workspace | null;
  refreshWorkspaces: () => Promise<void>; // Add refreshWorkspaces
}

// --- Context Definition ---

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);


// --- Provider Component ---

interface WorkspaceProviderProps {
  children: ReactNode;
}

const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('activeWorkspaceId');
  });
  const [isLoading, setIsLoading] = useState(true);

  // Define fetchWorkspaces as a stable callback
  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('workspaces').select('*');

    if (error) {
      console.error("Error fetching workspaces:", error);
      setWorkspaces([]);
    } else {
      setWorkspaces(data as Workspace[]);
      // If no workspace is selected, or the selected one doesn't exist, default to the first one.
      // Or if the previously active one is no longer available (e.g. deleted by RLS)
      if (!workspaceId || !data.some(w => w.id === workspaceId)) {
        const firstWorkspaceId = data[0]?.id || null;
        setWorkspaceInternal(firstWorkspaceId); // Use internal setter to avoid infinite loop
      }
    }
    setIsLoading(false);
  }, [workspaceId]); // Depend on workspaceId to re-evaluate default selection if it changes

  // Fetch workspaces on initial load and whenever a refresh is explicitly triggered
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]); // Depend on fetchWorkspaces callback

  // Internal setter for workspaceId to be used within the provider
  const setWorkspaceInternal = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('activeWorkspaceId', id);
    } else {
      localStorage.removeItem('activeWorkspaceId');
    }
    // As per requirements, clear the active agent when workspace changes.
    // The key is scoped by workspace to handle multiple workspaces.
    if (workspaceId) { // Use the current state's workspaceId before update
        localStorage.removeItem(`activeAgentId_${workspaceId}`);
    }
    localStorage.removeItem('activeAgentId'); // Also clear the generic one just in case
    
    setWorkspaceIdState(id);
    
    console.log("Workspace changed, related queries should be invalidated.");
  }, [workspaceId]); // Depend on workspaceId to clear correct agent ID

  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === workspaceId) || null;
  }, [workspaceId, workspaces]);


  const value: WorkspaceContextValue = {
    workspaceId,
    workspaces,
    setWorkspace: setWorkspaceInternal, // Expose internal setter
    isLoading,
    activeWorkspace,
    refreshWorkspaces: fetchWorkspaces, // Expose refresh function
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

export { WorkspaceProvider, useWorkspace };
