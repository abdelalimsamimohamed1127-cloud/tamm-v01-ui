// src/contexts/AgentContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Agent } from '@/types/primitives';
import { useWorkspaces } from './WorkspaceContext'; // Dependency on WorkspaceContext

// --- Type Definitions ---

interface AgentContextValue {
  agentId: string | null;
  agents: Agent[];
  setAgent: (id: string) => void;
  isLoading: boolean;
  activeAgent: Agent | null;
}

// --- Context Definition ---

export const AgentContext = createContext<AgentContextValue | undefined>(undefined);

// --- Provider Component ---

interface AgentProviderProps {
  children: ReactNode;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({ children }) => {
  const { workspaceId, isLoading: isWorkspaceLoading } = useWorkspaces();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set initial agentId from localStorage, scoped by workspaceId
  useEffect(() => {
    if (workspaceId) {
      const storedAgentId = localStorage.getItem(`activeAgentId_${workspaceId}`);
      setAgentIdState(storedAgentId);
    } else {
      setAgentIdState(null);
    }
  }, [workspaceId]);

  // Fetch agents when the workspace changes
  useEffect(() => {
    if (!workspaceId || isWorkspaceLoading) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    const fetchAgents = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .neq('status', 'archived');

      if (error) {
        console.error(`Error fetching agents for workspace ${workspaceId}:`, error);
        setAgents([]);
      } else {
        const fetchedAgents = data as Agent[];
        setAgents(fetchedAgents);
        
        // Behavior Rule: If selected agent no longer exists, fallback to first available agent.
        const currentAgentExists = fetchedAgents.some(a => a.id === agentId);
        if (!currentAgentExists && fetchedAgents.length > 0) {
          setAgent(fetchedAgents[0].id);
        } else if (fetchedAgents.length === 0) {
            setAgent(null); // No agents available
        }
      }
      setIsLoading(false);
    };

    fetchAgents();
  }, [workspaceId, isWorkspaceLoading]);
  
  const setAgent = (id: string | null) => {
    if (id && workspaceId) {
      localStorage.setItem(`activeAgentId_${workspaceId}`, id);
    } else if (workspaceId) {
      localStorage.removeItem(`activeAgentId_${workspaceId}`);
    }
    setAgentIdState(id);
  };

  const activeAgent = useMemo(() => {
    return agents.find(a => a.id === agentId) || null;
  }, [agentId, agents]);

  const value: AgentContextValue = {
    agentId,
    agents,
    setAgent,
    isLoading: isLoading || isWorkspaceLoading,
    activeAgent,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
};

// --- Hook for consuming the context ---

export const useAgents = (): AgentContextValue => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentProvider');
  }
  return context;
};
