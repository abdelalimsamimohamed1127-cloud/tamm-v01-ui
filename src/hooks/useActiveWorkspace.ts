import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

export function useActiveWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);

        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) {
          setWorkspace(null);
          return;
        }

        // Find workspace membership
        const { data: memberships, error: memErr } = await supabase
          .from('workspace_members')
          .select('workspace_id, workspaces ( id, name, owner_id )')
          .eq('user_id', user.id)
          .limit(1);

        if (memErr) throw memErr;

        if (memberships && memberships.length > 0) {
          setWorkspace(memberships[0].workspaces as Workspace);
          return;
        }

        // Auto-create workspace
        const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .insert({ name: 'My Workspace', owner_id: user.id })
          .select()
          .single();

        if (wsErr) throw wsErr;

        await supabase.from('workspace_members').insert({
          workspace_id: ws.id,
          user_id: user.id,
          role: 'owner',
        });

        setWorkspace(ws as Workspace);
      } catch (e: any) {
        setError(e.message ?? 'Failed to init workspace');
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, []);

  return { workspace, isLoading, error };
}