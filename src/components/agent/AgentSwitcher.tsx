// src/components/agent/AgentSwitcher.tsx
import * as React from "react"
import { ChevronsUpDown, PlusCircle, Search } from "lucide-react" // Import Search icon

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgents } from "@/contexts/AgentContext"
import { useWorkspaces } from "@/contexts/WorkspaceContext"
import { Input } from "@/components/ui/input" // Import Input component

interface AgentSwitcherProps {
  onCreateAgentClick: () => void;
}

export function AgentSwitcher({ onCreateAgentClick }: AgentSwitcherProps) { // Accept prop
  const { workspaceId } = useWorkspaces()
  const { activeAgent, agents, setAgent, isLoading } = useAgents()
  const [searchTerm, setSearchTerm] = React.useState("")

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!workspaceId) {
    return (
      <Button variant="outline" className="w-fit max-w-[128px] sm:w-48 justify-between" disabled> {/* Apply responsive class */}
        Select a workspace
        <ChevronsUpDown className="h-4 w-4" />
      </Button>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-fit max-w-[128px] sm:w-48" /> // Apply responsive class
  }

  if (agents.length === 0) {
    // Show "Create Agent" CTA if empty
    return (
      <Button variant="outline" onClick={onCreateAgentClick} className="w-fit max-w-[128px] sm:w-auto justify-start"> {/* Use prop and responsive width */}
        <PlusCircle className="mr-2 h-4 w-4" />
        Create Agent
      </Button>
    )
  }
  
  if (!activeAgent) {
    return <Skeleton className="h-8 w-fit max-w-[128px] sm:w-48" /> // Apply responsive class
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-fit max-w-[128px] sm:w-48 justify-between"> {/* Apply responsive class */}
          <span className="truncate">{activeAgent.name}</span>
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-0"> {/* Adjusted width and removed default padding */}
        <div className="relative p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search agents..."
                className="pl-9 pr-2 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <DropdownMenuLabel className="px-2 pt-0 pb-2">Switch Agent</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-60 overflow-y-auto"> {/* Added max-height and overflow for scrollability */}
          {filteredAgents.length > 0 ? (
            filteredAgents.map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                onSelect={() => {
                    setAgent(agent.id);
                    setSearchTerm(""); // Clear search after selection
                }}
                disabled={isLoading}
              >
                {agent.name}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No results found.</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator /> {/* Add separator before create option */}
        <DropdownMenuItem onSelect={() => {
            onCreateAgentClick();
            setSearchTerm(""); // Clear search after action
        }} disabled={!workspaceId}> {/* Add Create Agent option, disabled if no workspace */}
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Agent
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}