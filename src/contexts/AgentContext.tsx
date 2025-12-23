import { createContext, useContext, useMemo, useState } from "react";
import type { Agent as ServiceAgent } from "@/services/agents";

type Agent = ServiceAgent & {
  creditsUsed: number;
  creditsLimit: number;
  creditsReset: string;
};

interface AgentContextValue {
  agents: Agent[];
  currentAgentId: string;
  currentAgent: Agent | null;
  setCurrentAgentId: (id: string) => void;
  setAgentActiveState: (id: string, isActive: boolean) => void;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

const defaultAgents: Agent[] = [
  { id: "agt_001", name: "Default Agent", creditsUsed: 2, creditsLimit: 50, creditsReset: "Renews on May 1", is_active: true },
  { id: "agt_002", name: "Support Bot", creditsUsed: 10, creditsLimit: 75, creditsReset: "Renews on May 1", is_active: true },
  { id: "agt_003", name: "Sales Assistant", creditsUsed: 5, creditsLimit: 60, creditsReset: "Renews on May 1", is_active: true },
];

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [currentAgentId, setCurrentAgentId] = useState<string>(defaultAgents[0]?.id ?? "");

  const setAgentActiveState = (id: string, isActive: boolean) => {
    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, is_active: isActive } : agent)));
  };

  const value = useMemo<AgentContextValue>(() => {
    const currentAgent = agents.find((agent) => agent.id === currentAgentId) ?? agents[0] ?? null;
    return {
      agents,
      currentAgentId: currentAgent?.id ?? currentAgentId,
      currentAgent,
      setCurrentAgentId,
      setAgentActiveState,
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
