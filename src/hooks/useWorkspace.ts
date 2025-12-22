import { useContext } from 'react';
import type { Workspace } from '@/contexts/WorkspaceContext';
import { WorkspaceContext } from '@/contexts/WorkspaceContext';

interface WorkspaceHookValue {
  workspace: Workspace | null;
  isLoading: boolean;
  refreshWorkspace: () => Promise<void>;
}

export function useWorkspace(): WorkspaceHookValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    return {
      workspace: null,
      isLoading: true,
      refreshWorkspace: async () => {},
    };
  }

  return context;
}
