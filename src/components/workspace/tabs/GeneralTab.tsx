import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function GeneralTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your workspace name and URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Workspace Name</p>
            <Input defaultValue="My Workspace" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Workspace URL</p>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground bg-muted px-3 py-2 h-10 rounded-l-md border border-r-0">
                tamm.ac/
              </span>
              <Input defaultValue="my-workspace" className="rounded-l-none" />
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Your workspace URL is a unique slug. Changing it will redirect from the old URL.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button>Save Changes</Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete Workspace</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete this workspace and all of its data.
            </p>
          </div>
          <Button variant="destructive" className="w-full sm:w-auto">Delete Workspace</Button>
        </CardContent>
      </Card>
    </div>
  );
}
