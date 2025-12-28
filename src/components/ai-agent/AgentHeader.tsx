import React from 'react';
import { useAgent } from '@/hooks/useAgent'; // Assuming activeAgent is needed
import { Badge } from '@/components/ui/badge'; // Example UI component

interface AgentHeaderProps {
  agentId: string;
}

export const AgentHeader: React.FC<AgentHeaderProps> = ({ agentId }) => {
  const { activeAgent } = useAgent();

  if (!activeAgent || activeAgent.id !== agentId) {
    return (
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Loading Agent...</h1>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h1 className="text-xl font-semibold">{activeAgent.name}</h1>
      <Badge variant="secondary">{activeAgent.status}</Badge>
    </div>
  );
};
