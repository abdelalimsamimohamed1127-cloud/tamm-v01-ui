import { createContext, useContext, useMemo, useState } from "react";

type Agent = {
  id: string;
  name: string;
};

interface AgentContextValue {
  agents: Agent[];
  currentAgentId: string;
  currentAgent: Agent | null;
  setCurrentAgentId: (id: string) => void;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

const defaultAgents: Agent[] = [
  { id: "agt_001", name: "Default Agent" },
  { id: "agt_002", name: "Support Bot" },
  { id: "agt_003", name: "Sales Assistant" },
];

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents] = useState<Agent[]>(defaultAgents);
  const [currentAgentId, setCurrentAgentId] = useState<string>(defaultAgents[0]?.id ?? "");

  const value = useMemo<AgentContextValue>(() => {
    const currentAgent = agents.find((agent) => agent.id === currentAgentId) ?? agents[0] ?? null;
    return {
      agents,
      currentAgentId: currentAgent?.id ?? currentAgentId,
      currentAgent,
      setCurrentAgentId,
    };
  }, [agents, currentAgentId]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgentContext() {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error("useAgentContext must be used within an AgentProvider");
  }
  return ctx;
}
