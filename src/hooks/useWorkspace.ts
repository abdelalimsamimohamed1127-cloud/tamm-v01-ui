import { useContext } from 'react';
import { WorkspaceContext, Workspace } from '@/contexts/WorkspaceContext';

interface WorkspaceHookValue {
  workspace: Workspace;
  isLoading: boolean;
  refreshWorkspace: () => Promise<void>;
}

export function useWorkspace(): WorkspaceHookValue {
  const context = useContext(WorkspaceContext);

  if (!context || !context.workspace) {
    throw new Error('Workspace context not ready');
  }

  return {
    workspace: context.workspace,
    isLoading: context.isLoading,
    refreshWorkspace: context.refreshWorkspace,
  };
}
