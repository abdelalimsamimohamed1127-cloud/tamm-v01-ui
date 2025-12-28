import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  currentConfig: { phone_number?: string };
  onSave: (newConfig: { phone_number: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  fieldErrors: Record<string, string> | null;
}

export default function OwnerWhatsappNotifyConfig({ currentConfig, onSave, onCancel, isSaving, fieldErrors }: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (currentConfig?.phone_number !== undefined && currentConfig?.phone_number !== null) {
      setPhoneNumber(currentConfig.phone_number);
    }
  }, [currentConfig]);

  const handleSave = async () => {
    await onSave({ phone_number: phoneNumber });
  };

  const errorForPhoneNumber = fieldErrors?.phone_number;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="phone_number">WhatsApp Phone Number</Label>
        <p className="text-sm text-muted-foreground pb-2">
          Owner's WhatsApp number to send notifications to (e.g., +15551234567).
        </p>
        <Input
          id="phone_number"
          type="tel" // Use type="tel" for phone numbers
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+15551234567"
          className={errorForPhoneNumber ? 'border-destructive' : ''}
        />
        {errorForPhoneNumber && <p className="text-xs text-destructive mt-1">{errorForPhoneNumber}</p>}
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
