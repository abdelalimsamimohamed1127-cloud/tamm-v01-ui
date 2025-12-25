// src/components/workspace/WorkspaceSwitcher.tsx
import * as React from "react"
import { ChevronsUpDown, PlusCircle, Search } from "lucide-react" // Import PlusCircle icon and Search icon

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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspaces } from "@/contexts/WorkspaceContext"
import { Input } from "@/components/ui/input" // Import Input component

interface WorkspaceSwitcherProps {
  onCreateWorkspaceClick: () => void;
}

export function WorkspaceSwitcher({ onCreateWorkspaceClick }: WorkspaceSwitcherProps) { // Accept prop
  const { activeWorkspace, workspaces, setWorkspace, isLoading } = useWorkspaces()
  const [searchTerm, setSearchTerm] = React.useState("")

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return <Skeleton className="h-8 w-fit max-w-[128px] sm:w-48" /> // Apply responsive class here too
  }

  if (workspaces.length === 0) {
    // Handle case where user has no workspaces.
    return (
      <Button variant="outline" onClick={onCreateWorkspaceClick} className="w-fit max-w-[128px] sm:w-auto"> {/* Adjusted for new prop and responsive width */}
        <PlusCircle className="mr-2 h-4 w-4" />
        Create Workspace
      </Button>
    )
  }
  
  if (!activeWorkspace) {
    return <Skeleton className="h-8 w-fit max-w-[128px] sm:w-48" /> // Apply responsive class here too
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-fit max-w-[128px] sm:w-48 justify-between"> {/* Apply responsive class */}
          <span className="truncate">{activeWorkspace.name}</span>
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-0"> {/* Adjusted width and removed default padding */}
        <div className="relative p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search workspaces..."
                className="pl-9 pr-2 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <DropdownMenuLabel className="px-2 pt-0 pb-2">Switch Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-60 overflow-y-auto"> {/* Added max-height and overflow for scrollability */}
          {filteredWorkspaces.length > 0 ? (
            filteredWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => {
                    setWorkspace(workspace.id);
                    setSearchTerm(""); // Clear search after selection
                }}
                disabled={isLoading}
                className="flex justify-between"
              >
                <span>{workspace.name}</span>
                <Badge variant={workspace.plan === 'paid' ? 'default' : 'secondary'}>
                  {workspace.plan}
                </Badge>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No results found.</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator /> {/* Add separator before create option */}
        <DropdownMenuItem onSelect={() => {
            onCreateWorkspaceClick();
            setSearchTerm(""); // Clear search after action
        }}> {/* Add Create Workspace option */}
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}