import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Table, Webhook, Bell, Loader2 } from 'lucide-react';

interface Automation {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
}

const automationConfig = [
  {
    type: 'google_sheets',
    icon: Table,
    title: { en: 'Log to Google Sheets', ar: 'تسجيل في Google Sheets' },
    description: { en: 'Automatically log orders and conversations', ar: 'تسجيل الطلبات والمحادثات تلقائياً' },
  },
  {
    type: 'whatsapp_notification',
    icon: Bell,
    title: { en: 'WhatsApp Notifications', ar: 'إشعارات واتساب' },
    description: { en: 'Get notified about new orders on WhatsApp', ar: 'احصل على إشعارات الطلبات الجديدة' },
  },
  {
    type: 'n8n_webhook',
    icon: Webhook,
    title: { en: 'Trigger n8n Workflow', ar: 'تشغيل سير عمل n8n' },
    description: { en: 'Connect to n8n for advanced automations', ar: 'اربط مع n8n للأتمتة المتقدمة' },
  },
];

export default function Automations() {
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('workspace_id', workspace.id);

    if (!error && data) {
      setAutomations(data as Automation[]);
    }
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    void fetchAutomations();
  }, [fetchAutomations]);

  const handleToggle = async (automationId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('automations')
      .update({ enabled })
      .eq('id', automationId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      setAutomations((prev) =>
        prev.map((a) => (a.id === automationId ? { ...a, enabled } : a))
      );
      toast({
        title: enabled 
          ? (dir === 'rtl' ? 'تم التفعيل!' : 'Enabled!') 
          : (dir === 'rtl' ? 'تم الإيقاف' : 'Disabled'),
      });
    }
  };

  const getAutomation = (type: string) => automations.find((a) => a.type === type);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.automations')}</h1>
        <p className="text-muted-foreground">
          {dir === 'rtl' ? 'إدارة الأتمتة والتكاملات' : 'Manage automations and integrations'}
        </p>
      </div>

      <div className="grid gap-4">
        {automationConfig.map((config, i) => {
          const automation = getAutomation(config.type);

          return (
            <motion.div
              key={config.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <config.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {dir === 'rtl' ? config.title.ar : config.title.en}
                        </CardTitle>
                        <CardDescription>
                          {dir === 'rtl' ? config.description.ar : config.description.en}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={automation?.enabled || false}
                      onCheckedChange={(checked) =>
                        automation && handleToggle(automation.id, checked)
                      }
                    />
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
