import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks';
import { useToast } from '@/hooks/use-toast';
import * as automationsService from '@/services/automations';
import { Automation } from '@/types/automation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Config Components
import OrderThresholdAlertConfig from '@/components/automations/configs/OrderThresholdAlertConfig';
import WebhookForwardConfig from '@/components/automations/configs/WebhookForwardConfig';
import GoogleSheetsSyncConfig from '@/components/automations/configs/GoogleSheetsSyncConfig';
import OwnerWhatsappNotifyConfig from '@/components/automations/configs/OwnerWhatsappNotifyConfig'; // New import

import {
  Table,
  Webhook,
  Bell,
  Clock3,
  Ticket,
  Tag,
  AlertTriangle,
  Megaphone,
  ChevronDown,
} from 'lucide-react';

const automationConfig = [
  {
    type: 'after_hours_reply',
    icon: Clock3,
    title: 'Auto-reply outside business hours',
    description: 'Send a polite response and handoff when team is offline.',
  },
  {
    type: 'convert_to_ticket',
    icon: Ticket,
    title: 'Convert message to ticket',
    description: 'Turn flagged messages into tickets for support.',
  },
  {
    type: 'tag_order_intent',
    icon: Tag,
    title: 'Tag order intent',
    description: 'Automatically tag conversations with purchase intent.',
  },
  {
    type: 'notify_high_value',
    icon: Bell,
    title: 'Notify owner on high-value order',
    description: 'Send an alert when orders exceed your threshold.',
    configComponent: OrderThresholdAlertConfig,
  },
  {
    type: 'escalate_angry',
    icon: AlertTriangle,
    title: 'Escalate angry customer',
    description: 'Flag negative sentiment and route to a human quickly.',
  },
  {
    type: 'log_to_sheets',
    icon: Table,
    title: 'Log to Google Sheets',
    description: 'Record orders and conversations in your spreadsheet.',
    configComponent: GoogleSheetsSyncConfig,
  },
  {
    type: 'trigger_webhook',
    icon: Webhook,
    title: 'Trigger webhook (n8n/zap)',
    description: 'Ping external workflows for advanced actions.',
    configComponent: WebhookForwardConfig,
  },
  {
    type: 'broadcast_updates',
    icon: Megaphone,
    title: 'Broadcast status updates',
    description: 'Send quick updates to customers during incidents.',
  },
  { // New Automation Type
    type: 'owner_whatsapp_notify',
    icon: Bell, // Reusing Bell icon, or find a specific one if available
    title: 'Notify owner via WhatsApp',
    description: 'Send a direct WhatsApp message to the owner for specific events.',
    configComponent: OwnerWhatsappNotifyConfig,
  },
];

const AutomationSkeleton = () => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <Skeleton className="h-6 w-11 rounded-full" />
      </div>
    </CardHeader>
  </Card>
);

export default function Automations() {
  const { t, dir } = useLanguage();
  const { workspace: activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [automations, setAutomations] = useState<Record<string, Automation>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [configValidationErrors, setConfigValidationErrors] = useState<Record<string, string> | null>(null); // New state for validation errors

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const fetchAutomations = async () => {
      setIsLoading(true);
      try {
        const data = await automationsService.getAutomations(activeWorkspace.id);
        const normalizedAutomations = data.reduce<Record<string, Automation>>((acc, item) => {
          acc[item.key] = item;
          return acc;
        }, {});
        setAutomations(normalizedAutomations);
      } catch (error) {
        console.error(error);
        toast({
          title: t('common.error'),
          description: t('automations.errors.load'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAutomations();
  }, [activeWorkspace?.id, t, toast]);

  const handleToggle = async (key: string, enabled: boolean) => {
    const automationToUpdate = automations[key];
    if (!automationToUpdate) return;
    if (enabled === false) setEditingKey(null); // Close config on disable
    setConfigValidationErrors(null); // Clear errors on toggle

    setUpdatingKey(key);
    const originalState = { ...automations };

    setAutomations(prev => ({ ...prev[key], [key]: { ...prev[key], enabled } }));

    try {
      const updated = await automationsService.updateAutomation(automationToUpdate.id, { enabled });
      setAutomations(prev => ({ ...prev, [key]: updated }));
      toast({
        title: t('common.success'),
        description: t('automations.success.update'),
      });
    } catch (error) {
      setAutomations(originalState);
      toast({
        title: t('common.error'),
        description: t('automations.errors.update'),
        variant: 'destructive',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleSaveConfig = async (key: string, newConfig: object) => {
    const automationToUpdate = automations[key];
    if (!automationToUpdate) return;

    // --- Validation Step ---
    const validationResult = automationsService.validateAutomationConfig(key, newConfig);
    if (!validationResult.isValid) {
      setConfigValidationErrors(validationResult.errors); // Set field-specific errors
      toast({
        title: t('common.error'),
        description: Object.values(validationResult.errors).join(' '), // Concatenate all errors for toast
        variant: 'destructive',
      });
      setUpdatingKey(null); // Release saving state as validation failed
      return; // Block save
    }
    setConfigValidationErrors(null); // Clear errors if valid
    // --- End Validation Step ---

    setUpdatingKey(key);
    const originalState = { ...automations };

    setAutomations(prev => ({ ...prev, [key]: { ...prev[key], config: newConfig } }));

    try {
      const updated = await automationsService.updateAutomation(automationToUpdate.id, { config: newConfig });
      setAutomations(prev => ({ ...prev, [key]: updated }));
      toast({
        title: t('common.success'),
        description: t('automations.success.config_saved'), // Localized message
      });
      setEditingKey(null); // Close editor on success
    } catch (error) {
      setAutomations(originalState);
      toast({
        title: t('common.error'),
        description: t('automations.errors.config_save'), // Localized message
        variant: 'destructive',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  const renderConfigurator = (key: string) => {
    const ConfigComponent = automationConfig.find(c => c.type === key)?.configComponent;
    const automation = automations[key];

    if (!ConfigComponent || !automation) return null;

    // Pass fieldErrors down to the specific config component
    return (
      <ConfigComponent
        currentConfig={automation.config || {}}
        onSave={(newConfig) => handleSaveConfig(key, newConfig)}
        onCancel={() => { setEditingKey(null); setConfigValidationErrors(null); }} // Clear errors on cancel
        isSaving={updatingKey === key}
        fieldErrors={editingKey === key ? configValidationErrors : null} // Only pass errors for the currently editing automation
      />
    );
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.automations')}</h1>
        <p className="text-muted-foreground">
          Manage automations and integrations
        </p>
      </div>

      <div className="grid gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <AutomationSkeleton key={i} />)
          : automationConfig.map((config, i) => {
              const automation = automations[config.type];
              const enabled = automation?.enabled ?? false;
              const isEditing = editingKey === config.type;

              return (
                <motion.div
                  key={config.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <config.icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{config.title}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pl-4">
                           {enabled && config.configComponent && (
                            <Button variant="outline" size="sm" onClick={() => { setEditingKey(isEditing ? null : config.type); setConfigValidationErrors(null); }}> {/* Clear errors when opening/closing */}
                              <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${isEditing ? 'rotate-180' : ''}`} />
                              Configure
                            </Button>
                          )}
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => handleToggle(config.type, checked)}
                            disabled={!automation || updatingKey === config.type}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                          animate={{ opacity: 1, height: 'auto', paddingTop: '1rem', paddingBottom: '1rem' }}
                          exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                            <CardContent className="pt-0">
                                <div className="border-t pt-4">
                                    {renderConfigurator(config.type)}
                                </div>
                            </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
        {!isLoading && Object.keys(automations).length === 0 && (
            <div className="text-center text-muted-foreground py-12">
                <p>{t('automations.empty.title')}</p>
                <p className="text-sm">{t('automations.empty.description')}</p>
            </div>
        )}
      </div>
    </div>
  );
}
