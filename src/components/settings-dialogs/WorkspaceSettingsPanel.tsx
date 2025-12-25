import React from 'react';

// Import actual tab content components
import GeneralTab from '../workspace/tabs/GeneralTab';
import MembersTab from '../workspace/tabs/MembersTab';
import PlansTab from '../workspace/tabs/PlansTab';
import BillingTab from '../workspace/tabs/BillingTab';
import { Card } from '@/components/ui/card';

// --- Types ---
type SettingsTab = 'general' | 'members' | 'plans' | 'billing';

interface WorkspaceSettingsPanelProps {
  activeSettingTab: SettingsTab;
}

export const WorkspaceSettingsPanel: React.FC<WorkspaceSettingsPanelProps> = ({ activeSettingTab }) => {
  return (
    <Card className="p-6">
      {activeSettingTab === 'general' && <GeneralTab />}
      {activeSettingTab === 'members' && <MembersTab />}
      {activeSettingTab === 'plans' && <PlansTab />}
      {activeSettingTab === 'billing' && <BillingTab />}
    </Card>
  );
};
