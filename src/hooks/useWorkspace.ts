import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Workspace {
  id: string;
  name: string;
  plan: string;
  owner_id: string;
  created_at: string;
}

export function useWorkspace() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkspace() {
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

      if (data?.workspaces) {
        setWorkspace(data.workspaces as unknown as Workspace);
      }
      setLoading(false);
    }

    fetchWorkspace();
  }, [user]);

  return { workspace, loading };
}
