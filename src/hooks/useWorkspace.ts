import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Workspace {
  id: string;
  name: string;
  plan: string;
  owner_id: string;
  created_at: string;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaceId: string | null;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    if (!user) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching workspace:', error);
      setLoading(false);
      return;
    }

    setWorkspace((data?.workspaces as unknown as Workspace) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const value = useMemo(
    () => ({
      workspace,
      workspaceId: workspace?.id ?? null,
      loading,
      refreshWorkspace: loadWorkspace,
    }),
    [workspace, loading, loadWorkspace]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
