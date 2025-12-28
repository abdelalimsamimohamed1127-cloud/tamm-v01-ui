import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  currentConfig: { webhook_url?: string };
  onSave: (newConfig: { webhook_url: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  fieldErrors: Record<string, string> | null; // New prop for field-specific errors
}

export default function WebhookForwardConfig({ currentConfig, onSave, onCancel, isSaving, fieldErrors }: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    // Only update if currentConfig.webhook_url is defined, otherwise keep local state (e.g., for invalid inputs)
    if (currentConfig?.webhook_url !== undefined && currentConfig?.webhook_url !== null) {
      setUrl(currentConfig.webhook_url);
    }
  }, [currentConfig]);

  const handleSave = async () => {
    // The validation is handled by the parent component (Automations.tsx)
    // and passed down via fieldErrors. We just pass the current local state.
    await onSave({ webhook_url: url });
  };

  const errorForUrl = fieldErrors?.webhook_url;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="webhook_url">Webhook URL</Label>
        <p className="text-sm text-muted-foreground pb-2">
          We'll send a POST request with the event payload to this URL.
        </p>
        <Input
          id="webhook_url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-service.com/webhook"
          className={errorForUrl ? 'border-destructive' : ''}
        />
        {errorForUrl && <p className="text-xs text-destructive mt-1">{errorForUrl}</p>}
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
