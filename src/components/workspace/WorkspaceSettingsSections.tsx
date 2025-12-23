import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function WorkspaceGeneralSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Workspace name, ID, and danger actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Workspace name</p>
            <Input value="My Workspace" readOnly className="w-full" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Workspace ID</p>
            <Input value="ws_123456" readOnly className="bg-muted/70 w-full" />
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Delete workspace</p>
            <p className="text-xs text-muted-foreground">
              Remove workspace data permanently. Disabled in UI preview.
            </p>
          </div>
          <Button variant="destructive" disabled className="w-full sm:w-auto min-h-[44px]">
            Delete workspace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceMembersSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Invite or manage workspace collaborators.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Owner</Badge>
            <span className="text-sm font-medium">owner@workspace.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Member</Badge>
            <span className="text-sm font-medium">agent@workspace.com</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
            Remove member
          </Button>
          <Button disabled className="w-full sm:w-auto min-h-[44px]">Invite member</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspacePlansSettingsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Plans</CardTitle>
        <CardDescription>Current plan and upgrade options.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Pro</p>
              <p className="text-xs text-muted-foreground">Up to 5 agents, priority support</p>
            </div>
            <Badge>Active</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
            Downgrade
          </Button>
          <Button disabled className="w-full sm:w-auto min-h-[44px]">Upgrade</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceBillingSettingsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Payment method and invoices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-sm font-semibold">Visa ending 4242</p>
          <p className="text-xs text-muted-foreground">Next charge: $120 on Feb 28</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
            Update payment
          </Button>
          <Button disabled className="w-full sm:w-auto min-h-[44px]">Download invoices</Button>
        </div>
      </CardContent>
    </Card>
  );
}
