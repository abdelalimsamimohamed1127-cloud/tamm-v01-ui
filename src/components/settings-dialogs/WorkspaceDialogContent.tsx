import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  WorkspaceBillingSettingsCard,
  WorkspaceGeneralSettingsCard,
  WorkspaceMembersSettingsCard,
  WorkspacePlansSettingsCard,
} from "@/components/workspace/WorkspaceSettingsSections";

export default function WorkspaceDialogContent() {
  return (
    <div className="w-full max-w-3xl">
      <ScrollArea className="h-[70vh] pr-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Workspace settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage workspace identity, members, plans, and billing (UI only).
            </p>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4">
              <div className="space-y-4">
                <WorkspaceGeneralSettingsCard />
                <WorkspacePlansSettingsCard />
              </div>
            </TabsContent>

            <TabsContent value="members" className="pt-4">
              <WorkspaceMembersSettingsCard />
            </TabsContent>

            <TabsContent value="billing" className="pt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <WorkspaceBillingSettingsCard />
                <WorkspacePlansSettingsCard />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
