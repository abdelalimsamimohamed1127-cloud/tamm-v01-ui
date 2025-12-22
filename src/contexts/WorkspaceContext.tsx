import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/* =========================
   Types
========================= */

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

/* =========================
   Context
========================= */

export const WorkspaceContext =
  createContext<WorkspaceContextValue | undefined>(undefined);

/* =========================
   Provider
========================= */

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    if (!user || !supabase || !isSupabaseConfigured) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspaces(*)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching workspace:', error);
      setWorkspace(null);
    } else {
      setWorkspace((data?.workspaces as Workspace) ?? null);
    }

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

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
