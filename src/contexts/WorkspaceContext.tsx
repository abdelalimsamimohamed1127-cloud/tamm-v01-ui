import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  owner_id: string;
  created_at: string;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  isLoading: boolean;
  refreshWorkspace: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching workspace:', error);
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    setWorkspace((data?.workspaces as unknown as Workspace) ?? null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const value = useMemo(
    () => ({
      workspace,
      isLoading,
      refreshWorkspace: loadWorkspace,
    }),
    [workspace, isLoading, loadWorkspace]
  );

  if (user && isLoading) {
    return null;
  }

  if (user && !isLoading && !workspace) {
    throw new Error('Workspace not found');
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
