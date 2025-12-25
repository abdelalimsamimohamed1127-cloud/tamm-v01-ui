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

export default function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [inviteCode, setInviteCode] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create or Join Workspace</DialogTitle>
          <DialogDescription>
            A workspace is a shared environment for your team to collaborate.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create" className="pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
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
                        <Input id="workspace-name" placeholder="Acme Inc." />
                    </div>
                     <div className="space-y-2">
                        <p className="text-sm font-medium">Workspace URL</p>
                        <div className="flex items-center">
                        <span className="text-sm text-muted-foreground bg-muted px-3 h-10 flex items-center rounded-l-md border border-r-0">
                            tamm.ac/
                        </span>
                        <Input id="workspace-url" placeholder="my-workspace" className="rounded-l-none" />
                        </div>
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button>Create Workspace</Button>
                </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="join">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader>
                <CardTitle>Join an existing workspace</CardTitle>
                <CardDescription>
                  Paste an invitation link or code provided by the workspace owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invitation Link or Code</Label>
                  <Input 
                    id="invite-code" 
                    placeholder="e.g., https://tamm.ac/join/..." 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button disabled={!inviteCode}>Join Workspace</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
