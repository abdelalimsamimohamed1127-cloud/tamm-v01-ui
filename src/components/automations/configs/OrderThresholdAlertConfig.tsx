import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  currentConfig: { threshold_amount?: number };
  onSave: (newConfig: { threshold_amount: number }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  fieldErrors: Record<string, string> | null; // New prop for field-specific errors
}

export default function OrderThresholdAlertConfig({ currentConfig, onSave, onCancel, isSaving, fieldErrors }: Props) {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    // Only update if currentConfig.threshold_amount is defined, otherwise keep local state (e.g., for invalid inputs)
    if (currentConfig?.threshold_amount !== undefined && currentConfig?.threshold_amount !== null) {
      setAmount(String(currentConfig.threshold_amount));
    }
  }, [currentConfig]);

  const handleSave = async () => {
    // The validation is handled by the parent component (Automations.tsx)
    // and passed down via fieldErrors. We just pass the current local state.
    await onSave({ threshold_amount: parseFloat(amount) });
  };

  const errorForAmount = fieldErrors?.threshold_amount;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="threshold_amount">Alert Threshold</Label>
        <p className="text-sm text-muted-foreground pb-2">
          Notify when an order total (in your store's currency) exceeds this value.
        </p>
        <Input
          id="threshold_amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g., 100"
          className={errorForAmount ? 'border-destructive' : ''}
        />
        {errorForAmount && <p className="text-xs text-destructive mt-1">{errorForAmount}</p>}
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
