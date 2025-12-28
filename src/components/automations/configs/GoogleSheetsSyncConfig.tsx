import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  currentConfig: { sheet_id?: string };
  onSave: (newConfig: { sheet_id: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  fieldErrors: Record<string, string> | null; // New prop for field-specific errors
}

export default function GoogleSheetsSyncConfig({ currentConfig, onSave, onCancel, isSaving, fieldErrors }: Props) {
  const [sheetId, setSheetId] = useState('');

  useEffect(() => {
    // Only update if currentConfig.sheet_id is defined, otherwise keep local state (e.g., for invalid inputs)
    if (currentConfig?.sheet_id !== undefined && currentConfig?.sheet_id !== null) {
      setSheetId(currentConfig.sheet_id);
    }
  }, [currentConfig]);

  const handleSave = async () => {
    // The validation is handled by the parent component (Automations.tsx)
    // and passed down via fieldErrors. We just pass the current local state.
    await onSave({ sheet_id: sheetId.trim() });
  };

  const errorForSheetId = fieldErrors?.sheet_id;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sheet_id">Google Sheet ID</Label>
        <p className="text-sm text-muted-foreground pb-2">
          You can find this in the URL of your Google Sheet.
        </p>
        <Input
          id="sheet_id"
          type="text"
          value={sheetId}
          onChange={(e) => setSheetId(e.target.value)}
          placeholder="e.g., 1BxiMzvRNpr..."
          className={errorForSheetId ? 'border-destructive' : ''}
        />
        {errorForSheetId && <p className="text-xs text-destructive mt-1">{errorForSheetId}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
