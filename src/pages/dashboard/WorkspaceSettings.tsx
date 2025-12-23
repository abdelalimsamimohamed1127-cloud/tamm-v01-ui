import {
  WorkspaceBillingSettingsCard,
  WorkspaceGeneralSettingsCard,
  WorkspaceMembersSettingsCard,
  WorkspacePlansSettingsCard,
} from "@/components/workspace/WorkspaceSettingsSections";

export default function WorkspaceSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <p className="text-sm text-muted-foreground">Manage workspace identity, members, plans, and billing (UI only).</p>
      </div>

      <WorkspaceGeneralSettingsCard />

      <WorkspaceMembersSettingsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspacePlansSettingsCard />
        <WorkspaceBillingSettingsCard />
      </div>
    </div>
  );
}
