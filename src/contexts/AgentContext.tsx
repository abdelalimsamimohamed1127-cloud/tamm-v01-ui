// src/contexts/AgentContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Agent, listAgents } from '@/services/agents'; // Import Agent and listAgents from services
import { useWorkspace } from '@/hooks';

// --- Type Definitions ---

interface AgentContextValue {
  agentId: string | null;
  agents: Agent[];
  setAgent: (id: string | null) => void;
  isLoading: boolean;
  activeAgent: Agent | null;
  refreshAgents: () => Promise<void>;
}

// --- Context Definition ---

export const AgentContext = createContext<AgentContextValue | undefined>(undefined);

// --- Provider Component ---

interface AgentProviderProps {
  children: ReactNode;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({ children }) => {
  const { workspaceId, isLoading: isWorkspaceLoading } = useWorkspace();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Define fetchAgents as a stable callback
  const fetchAgents = useCallback(async () => {
    if (!workspaceId || isWorkspaceLoading) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use the service function to fetch agents
      const fetchedAgents = await listAgents(workspaceId);
      setAgents(fetchedAgents);
      
      // Behavior Rule: If selected agent no longer exists, fallback to first available agent.
      const currentAgentExists = fetchedAgents.some(a => a.id === agentId);
      if (!currentAgentExists && fetchedAgents.length > 0) {
        setAgentInternal(fetchedAgents[0].id);
      } else if (fetchedAgents.length === 0) {
          setAgentInternal(null);
      }
    } catch (error) {
      console.error(`Error fetching agents for workspace ${workspaceId}:`, error);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, isWorkspaceLoading, agentId]);

  // Set initial agentId from localStorage, scoped by workspaceId
  useEffect(() => {
    if (workspaceId) {
      const storedAgentId = localStorage.getItem(`activeAgentId_${workspaceId}`);
      setAgentIdState(storedAgentId);
    } else {
      setAgentIdState(null);
    }
  }, [workspaceId]);

  // Fetch agents on initial load and whenever a refresh is explicitly triggered
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Internal setter for agentId to be used within the provider
  const setAgentInternal = useCallback((id: string | null) => {
    if (id && workspaceId) {
      localStorage.setItem(`activeAgentId_${workspaceId}`, id);
    } else if (workspaceId) {
      localStorage.removeItem(`activeAgentId_${workspaceId}`);
    }
    setAgentIdState(id);
  }, [workspaceId]);

  const activeAgent = useMemo(() => {
    return agents.find(a => a.id === agentId) || null;
  }, [agentId, agents]);

  const value: AgentContextValue = {
    agentId,
    agents,
    setAgent: setAgentInternal,
    isLoading: isLoading || isWorkspaceLoading,
    activeAgent,
    refreshAgents: fetchAgents,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
};

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within a AgentProvider');
  }
  return context;
}

