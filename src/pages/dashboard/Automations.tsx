import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  Webhook,
  Bell,
  Clock3,
  Ticket,
  Tag,
  AlertTriangle,
  Megaphone,
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
  },
  {
    type: 'trigger_webhook',
    icon: Webhook,
    title: 'Trigger webhook (n8n/zap)',
    description: 'Ping external workflows for advanced actions.',
  },
  {
    type: 'broadcast_updates',
    icon: Megaphone,
    title: 'Broadcast status updates',
    description: 'Send quick updates to customers during incidents.',
  },
];

export default function Automations() {
  const { t, dir } = useLanguage();
  const [states, setStates] = useState<Record<string, boolean>>(() => {
    return automationConfig.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.type] = false;
      return acc;
    }, {});
  });

  const toggleAutomation = (type: string, enabled: boolean) => {
    setStates((prev) => ({ ...prev, [type]: enabled }));
  };

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
          const enabled = states[config.type];

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
                        <CardTitle className="text-lg">{config.title}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => toggleAutomation(config.type, checked)}
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
