import { supabase } from '@/lib/supabase';
import { Automation } from '@/types/automation';

export const getAutomations = async (workspace_id: string) => {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('workspace_id', workspace_id);

  if (error) {
    console.error('Error fetching automations:', error);
    throw new Error(error.message);
  }

  return data as Automation[];
};

export const updateAutomation = async (
  id: string,
  payload: Partial<Pick<Automation, 'enabled' | 'config'>>
) => {
  const { data, error } = await supabase
    .from('automations')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating automation:', error);
    throw new Error(error.message);
  }

  return data as Automation;
};

// --- Validation Logic ---

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>; // Maps field name to error message
}

const validateOrderThresholdAlertConfig = (config: Record<string, any>): ValidationResult => {
  const errors: Record<string, string> = {};
  const thresholdAmount = config.threshold_amount;

  if (thresholdAmount === undefined || thresholdAmount === null || thresholdAmount === '') {
    errors.threshold_amount = 'Threshold amount is required.';
  } else {
    const numAmount = parseFloat(thresholdAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      errors.threshold_amount = 'Threshold amount must be a number greater than 0.';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateWebhookForwardConfig = (config: Record<string, any>): ValidationResult => {
  const errors: Record<string, string> = {};
  const webhookUrl = config.webhook_url;

  if (!webhookUrl) {
    errors.webhook_url = 'Webhook URL is required.';
  } else {
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== 'https:') {
        errors.webhook_url = 'Webhook URL must use HTTPS protocol.';
      }
    } catch {
      errors.webhook_url = 'Webhook URL is not a valid URL.';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateGoogleSheetsSyncConfig = (config: Record<string, any>): ValidationResult => {
  const errors: Record<string, string> = {};
  const sheetId = config.sheet_id;

  if (!sheetId || sheetId.trim() === '') {
    errors.sheet_id = 'Google Sheet ID is required and cannot be empty.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateOwnerWhatsappNotifyConfig = (config: Record<string, any>): ValidationResult => {
  const errors: Record<string, string> = {};
  const phoneNumber = config.phone_number;

  // Basic phone number format validation (e.g., non-empty, contains only digits and optional '+' at start)
  // This can be made more robust with a dedicated library if needed.
  if (!phoneNumber) {
    errors.phone_number = 'Phone number is required.';
  } else if (!/^\+?[0-9\s-()]+$/.test(phoneNumber.trim())) { // Allows +, digits, spaces, hyphens, parentheses
    errors.phone_number = 'Phone number format is invalid.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

const validatorMap: Record<string, (config: Record<string, any>) => ValidationResult> = {
  order_threshold_alert: validateOrderThresholdAlertConfig,
  webhook_forward: validateWebhookForwardConfig,
  google_sheets_sync: validateGoogleSheetsSyncConfig,
  owner_whatsapp_notify: validateOwnerWhatsappNotifyConfig,
};

export const validateAutomationConfig = (key: string, config: Record<string, any>): ValidationResult => {
  const validator = validatorMap[key];
  if (!validator) {
    // If no specific validator is found, assume it's valid for now, or return an error if desired.
    return { isValid: true, errors: {} };
  }
  return validator(config);
};
