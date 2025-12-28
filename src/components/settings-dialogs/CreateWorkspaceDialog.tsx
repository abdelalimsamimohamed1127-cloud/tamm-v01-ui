import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useWorkspace } from '@/hooks'; // Import useWorkspace
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { toast } from '@/hooks/use-toast'; // Import toast
import { supabase } from '@/integrations/supabase/client'; // Import supabase

export default function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  // const [inviteCode, setInviteCode] = useState(''); // Removed as per Stage 1.3 directive

  const [workspaceName, setWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useAuth();
  const { setWorkspace, refreshWorkspaces } = useWorkspace();

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast({
        title: "Validation Error",
        description: "Workspace name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a workspace.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Part 1: Insert into public.workspaces
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({ name: workspaceName.trim(), created_by: user.id })
        .select('id')
        .single();

      if (workspaceError || !workspaceData) {
        throw new Error(workspaceError?.message || "Failed to create workspace.");
      }

      const newWorkspaceId = workspaceData.id;

      // Part 2: Insert into public.workspace_members
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: newWorkspaceId, user_id: user.id, role: 'owner' });

      if (membershipError) {
        throw new Error(membershipError?.message || "Failed to assign ownership to workspace.");
      }

      // Part 3: Context Update
      await refreshWorkspaces(); // Refresh the list of workspaces
      setWorkspace(newWorkspaceId); // Switch active workspace to the new one

      // Part 4: UI Feedback
      toast({
        title: "Success",
        description: `Workspace "${workspaceName.trim()}" created successfully!`,
      });
      onOpenChange(false); // Close dialog on success
      setWorkspaceName(''); // Clear input

    } catch (error: any) {
      console.error("Error creating workspace:", error.message);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while creating the workspace.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle> {/* Changed title */}
          <DialogDescription>
            A workspace is a shared environment for your team to collaborate.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create" className="pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create</TabsTrigger>
            {/* Stage 1.3 directive: Hide "Join Workspace" button */}
            <TabsTrigger value="join" disabled>Join</TabsTrigger> 
          </TabsList>
          <TabsContent value="create">
            <Card className="border-t-0 rounded-t-none">
                <CardHeader>
                    <CardTitle>Create a new workspace</CardTitle>
                    <CardDescription>
                    Create a new workspace and invite your team members.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="workspace-name">Workspace Name</Label>
                        <Input
                            id="workspace-name"
                            placeholder="Acme Inc."
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                     <div className="space-y-2">
                        <p className="text-sm font-medium">Workspace URL</p>
                        <div className="flex items-center">
                        <span className="text-sm text-muted-foreground bg-muted px-3 h-10 flex items-center rounded-l-md border border-r-0">
                            tamm.ac/
                        </span>
                        <Input id="workspace-url" placeholder="my-workspace" className="rounded-l-none" disabled /> {/* Disabled as not implemented */}
                        </div>
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleCreateWorkspace} disabled={isLoading || !workspaceName.trim()}>
                        {isLoading ? 'Creating...' : 'Create Workspace'}
                    </Button>
                </CardFooter>
            </Card>
          </TabsContent>
          {/* Stage 1.3 directive: Remove "Join Workspace" content for now */}
          <TabsContent value="join">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader>
                <CardTitle>Join an existing workspace</CardTitle>
                <CardDescription>
                  Joining workspaces is currently disabled. Please create a new workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invitation Link or Code</Label>
                  <Input 
                    id="invite-code" 
                    placeholder="Joining disabled" 
                    value={''} // Clear value
                    disabled // Disable input
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button disabled>Join Workspace</Button> {/* Disable button */}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
