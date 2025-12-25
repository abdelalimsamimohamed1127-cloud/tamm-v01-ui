import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import GeneralTab from "../workspace/tabs/GeneralTab";
import MembersTab from "../workspace/tabs/MembersTab";
import UsageTab from "../workspace/tabs/UsageTab";
import BillingTab from "../workspace/tabs/BillingTab";
import PlansTab from "../workspace/tabs/PlansTab";

export default function WorkspaceSettingsDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full flex flex-col sm:h-[90vh]">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Manage your workspace settings and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-auto">
          <Tabs defaultValue="general" className="h-full flex flex-col sm:flex-row gap-4" orientation={isMobile ? 'horizontal' : 'vertical'}>
            <TabsList className="flex flex-wrap -mx-4 sm:flex-col sm:w-1/5 sm:h-auto sm:border-r">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
            </TabsList>
            <div className="flex-1 sm:w-4/5 p-1">
              <TabsContent value="general">
                <GeneralTab />
              </TabsContent>
              <TabsContent value="members">
                <MembersTab />
              </TabsContent>
              <TabsContent value="usage">
                <UsageTab />
              </TabsContent>
              <TabsContent value="billing">
                <BillingTab />
              </TabsContent>
              <TabsContent value="plans">
                <PlansTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
