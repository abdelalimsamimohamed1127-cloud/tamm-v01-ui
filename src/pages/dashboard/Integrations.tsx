// src/pages/dashboard/Integrations.tsx

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, RefreshCw, Loader2, Link as LinkIcon, Edit, Trash2 } from 'lucide-react'; // LinkIcon for Integrations
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';

// Define Connector type based on backend model
interface Connector {
  id: string;
  workspace_id: string;
  type: string;
  name: string;
  config: {
    domain: string;
    auth_type: string;
    sync_mode: string;
    [key: string]: any; // Allow other config fields
  };
  status: 'inactive' | 'active' | 'error';
  last_sync_at: string | null;
  created_at: string;
}

// --- API Service Functions ---
// These would typically be in src/services/integrations.ts
const integrationsService = {
  listConnectors: async (workspaceId: string, token: string): Promise<Connector[]> => {
    const response = await fetch(`/api/v1/integrations/connectors`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch connectors');
    }
    return response.json();
  },

  createConnector: async (workspaceId: string, connectorData: Partial<Connector>, token: string): Promise<Connector> => {
    const response = await fetch(`/api/v1/integrations/connectors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
      body: JSON.stringify(connectorData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create connector');
    }
    return response.json();
  },

  triggerSync: async (connectorId: string, workspaceId: string, token: string): Promise<Connector> => {
    const response = await fetch(`/api/v1/integrations/connectors/${connectorId}/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to trigger sync');
    }
    return response.json();
  },
};

// --- Add Connector Wizard Steps ---
interface WizardFormData {
  name: string;
  domain: string;
  type: string;
  auth_type: string;
  sync_mode: string;
}

const initialWizardState: WizardFormData = {
  name: '',
  domain: '',
  type: '',
  auth_type: '',
  sync_mode: 'manual',
};

const domains = ['hr', 'crm', 'erp', 'other'];
const connectorTypes = [
  { value: 'google_sheets', label: 'Google Sheets' },
  { value: 'custom_api', label: 'Custom API' },
  { value: 'hr_system', label: 'HR System' },
  { value: 'crm_system', label: 'CRM System' },
  { value: 'erp_system', label: 'ERP System' },
];
const authTypes = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth (Placeholder)' },
  { value: 'service_account', label: 'Service Account (Placeholder)' },
];
const syncModes = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Scheduled (Future)' },
];

const AddConnectorWizard: React.FC<{
  onConnectorCreated: () => void;
  onClose: () => void;
}> = ({ onConnectorCreated, onClose }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>(initialWizardState);
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const createConnectorMutation = useMutation({
    mutationFn: (data: Partial<Connector>) =>
      integrationsService.createConnector(activeWorkspace!.id, data, token!),
    onSuccess: () => {
      toast.success('Connector created successfully!');
      queryClient.invalidateQueries({ queryKey: ['connectors', activeWorkspace?.id] });
      onConnectorCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Error creating connector: ${error.message}`);
    },
  });

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSelectChange = (name: keyof WizardFormData, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = () => {
    if (!activeWorkspace?.id || !token) {
      toast.error('Workspace or authentication token missing.');
      return;
    }
    // Only send relevant data collected in the wizard
    createConnectorMutation.mutate({
      name: formData.name,
      type: formData.type,
      config: { // Backend expects domain, auth_type, sync_mode within config
        domain: formData.domain,
        auth_type: formData.auth_type,
        sync_mode: formData.sync_mode,
      },
    });
  };

  const renderStep = () => {
    switch (step) {
      case 1: // Domain Selection
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step 1: Choose Domain</h3>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Select onValueChange={(value) => handleSelectChange('domain', value)} value={formData.domain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6">
              <Button onClick={handleNext} disabled={!formData.domain}>Next</Button>
            </DialogFooter>
          </div>
        );
      case 2: // Connector Type
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step 2: Select Connector Type</h3>
            <div className="space-y-2">
              <Label htmlFor="type">Connector Type</Label>
              <Select onValueChange={(value) => handleSelectChange('type', value)} value={formData.type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {connectorTypes.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button onClick={handleNext} disabled={!formData.type}>Next</Button>
            </DialogFooter>
          </div>
        );
      case 3: // Auth Type
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step 3: Authentication Method</h3>
            <div className="space-y-2">
              <Label htmlFor="auth_type">Auth Type</Label>
              <Select onValueChange={(value) => handleSelectChange('auth_type', value)} value={formData.auth_type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select auth method" />
                </SelectTrigger>
                <SelectContent>
                  {authTypes.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button onClick={handleNext} disabled={!formData.auth_type}>Next</Button>
            </DialogFooter>
          </div>
        );
      case 4: // Sync Mode
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step 4: Sync Mode</h3>
            <div className="space-y-2">
              <Label htmlFor="sync_mode">Sync Mode</Label>
              <Select onValueChange={(value) => handleSelectChange('sync_mode', value)} value={formData.sync_mode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sync mode" />
                </SelectTrigger>
                <SelectContent>
                  {syncModes.map((sm) => (
                    <SelectItem key={sm.value} value={sm.value}>
                      {sm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button onClick={handleNext} disabled={!formData.sync_mode}>Next</Button>
            </DialogFooter>
          </div>
        );
      case 5: // Review and Create
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step 5: Review & Name Connector</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4">
                <p><strong>Domain:</strong> {formData.domain}</p>
                <p><strong>Type:</strong> {connectorTypes.find(c => c.value === formData.type)?.label}</p>
                <p><strong>Auth:</strong> {authTypes.find(a => a.value === formData.auth_type)?.label}</p>
                <p><strong>Sync:</strong> {syncModes.find(s => s.value === formData.sync_mode)?.label}</p>
              </div>
              <Label htmlFor="name" className="mt-4 block">Connector Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Google Sheets for HR Data"
              />
            </div>
            <DialogFooter className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button onClick={handleSubmit} disabled={createConnectorMutation.isPending || !formData.name}>
                {createConnectorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Connector
              </Button>
            </DialogFooter>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Connector</DialogTitle>
          <DialogDescription>
            Configure a new data source for your workspace.
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
};

// --- Main Integrations Page ---
export default function Integrations() {
  const { activeWorkspace } = useWorkspace();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const {
    data: connectors,
    isLoading,
    isError,
    error,
  } = useQuery<Connector[], Error>({
    queryKey: ['connectors', activeWorkspace?.id],
    queryFn: () => integrationsService.listConnectors(activeWorkspace!.id, token!),
    enabled: Boolean(activeWorkspace?.id && token),
  });

  const triggerSyncMutation = useMutation({
    mutationFn: ({ connectorId, workspaceId }: { connectorId: string; workspaceId: string }) =>
      integrationsService.triggerSync(connectorId, workspaceId, token!),
    onSuccess: (updatedConnector) => {
      toast.success(`Sync triggered for ${updatedConnector.name}!`);
      queryClient.invalidateQueries({ queryKey: ['connectors', activeWorkspace?.id] }); // Re-fetch list
    },
    onError: (error: Error) => {
      toast.error(`Error triggering sync: ${error.message}`);
    },
  });

  const handleTriggerSync = (connectorId: string) => {
    if (!activeWorkspace?.id) {
      toast.error('Workspace missing for sync.');
      return;
    }
    triggerSyncMutation.mutate({ connectorId, workspaceId: activeWorkspace.id });
  };

  if (!activeWorkspace?.id) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <LinkIcon size={48} className="mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
        <p>Please select a workspace to manage integrations.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Integrations</h1>
        <div className="space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading connectors...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-red-500">
        <h1 className="text-3xl font-bold mb-6">Integrations</h1>
        <p>Error loading connectors: {error?.message}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['connectors', activeWorkspace?.id] })}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsWizardOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Connector
            </Button>
          </DialogTrigger>
          {isWizardOpen && <AddConnectorWizard onConnectorCreated={() => setIsWizardOpen(false)} onClose={() => setIsWizardOpen(false)} />}
        </Dialog>
      </div>

      {!connectors || connectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg text-muted-foreground">
          <LinkIcon size={48} className="mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Connectors Configured</h2>
          <p className="mb-4">Get started by adding your first data integration.</p>
          <Button onClick={() => setIsWizardOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Connector
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connectors.map((connector) => (
              <TableRow key={connector.id}>
                <TableCell className="font-medium">{connector.name}</TableCell>
                <TableCell>{connector.type}</TableCell>
                <TableCell>{connector.config.domain?.toUpperCase()}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      connector.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : connector.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {connector.status.charAt(0).toUpperCase() + connector.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>
                  {connector.last_sync_at
                    ? formatDistanceToNow(parseISO(connector.last_sync_at), { addSuffix: true })
                    : 'Never'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTriggerSync(connector.id)}
                    disabled={triggerSyncMutation.isPending}
                    aria-label={`Trigger sync for ${connector.name}`}
                  >
                    {triggerSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  {/* Future: Edit/Delete buttons */}
                  {/* <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button> */}
                  {/* <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button> */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

    </div>
  );
}
