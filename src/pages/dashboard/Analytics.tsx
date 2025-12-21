import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PLAN_LIMITS, normalizePlanTier, formatBytes } from '@/lib/plan';

type UsageRow = {
  period_yyyymm: string;
  messages_in: number | null;
  messages_out: number | null;
  kb_bytes: number | null;
  channels_count: number | null;
  agents_count: number | null;
  sources_count: number | null;
};

export default function Analytics() {
  const { t } = useLanguage();
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [tier, setTier] = useState<'free' | 'paid1' | 'paid2' | 'paid3'>('free');
  const [usage, setUsage] = useState<UsageRow | null>(null);

  const period = useMemo(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }, []);

  const limits = PLAN_LIMITS[tier];

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: wsSettings } = await supabase
        .from('workspace_settings')
        .select('plan_tier')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (!active) return;
      setTier(normalizePlanTier(wsSettings?.plan_tier) as any);

      const { data: usageRow } = await supabase
        .from('usage_counters')
        .select('period_yyyymm,messages_in,messages_out,kb_bytes,channels_count,agents_count,sources_count')
        .eq('workspace_id', workspace.id)
        .eq('period_yyyymm', period)
        .maybeSingle();

      if (!active) return;
      setUsage((usageRow as any) ?? null);
    })();

    return () => {
      active = false;
    };
  }, [workspace.id, period]);

  const metrics = useMemo(() => {
    const u = usage ?? {
      period_yyyymm: period,
      messages_in: 0,
      messages_out: 0,
      kb_bytes: 0,
      channels_count: 0,
      agents_count: 0,
      sources_count: 0,
    };

    const safe = (n: any) => (typeof n === 'number' ? n : 0);

    return {
      in: safe(u.messages_in),
      out: safe(u.messages_out),
      kb: safe(u.kb_bytes),
      channels: safe(u.channels_count),
      agents: safe(u.agents_count),
      sources: safe(u.sources_count),
    };
  }, [usage, period]);

  const percent = (v: number, max: number) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((v / max) * 100));
  };

  async function refreshUsage() {
    setRefreshing(true);
    const { data, error } = await supabase.functions.invoke('recompute_usage', {
      body: { workspace_id: workspace.id, period_yyyymm: period },
    });
    setRefreshing(false);
    if (error) {
      toast({ title: 'Usage', description: error.message, variant: 'destructive' });
      return;
    }
    if (data?.usage) setUsage(data.usage as any);
    if (data?.tier) setTier(normalizePlanTier(data.tier) as any);
    toast({ title: 'Usage refreshed', description: 'Counts were recomputed from DB.' });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={refreshUsage} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</Button>
        <div>
          <h1 className="text-2xl font-semibold">{t('Analytics')}</h1>
          <p className="text-sm text-muted-foreground">
            Usage & limits for period <span className="font-mono">{period}</span>
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          Plan: {tier}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Monthly message usage (in/out)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Inbound</span>
                <span className="font-mono">{metrics.in} / {limits.maxMessagesInPerMonth}</span>
              </div>
              <Progress value={percent(metrics.in, limits.maxMessagesInPerMonth)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Outbound (AI)</span>
                <span className="font-mono">{metrics.out} / {limits.maxMessagesOutPerMonth}</span>
              </div>
              <Progress value={percent(metrics.out, limits.maxMessagesOutPerMonth)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Hard blocks apply when limits are reached. Draft suggestions do not count as outbound AI messages.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>Storage + sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>KB bytes</span>
                <span className="font-mono">{formatBytes(metrics.kb)} / {formatBytes(limits.maxKbBytes)}</span>
              </div>
              <Progress value={percent(metrics.kb, limits.maxKbBytes)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Agents</div>
                <div className="text-lg font-semibold">{metrics.agents}<span className="text-xs text-muted-foreground"> / {limits.maxAgents}</span></div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Channels</div>
                <div className="text-lg font-semibold">{metrics.channels}<span className="text-xs text-muted-foreground"> / {limits.maxChannels}</span></div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Sources</div>
                <div className="text-lg font-semibold">{metrics.sources}<span className="text-xs text-muted-foreground"> / {limits.maxSources}</span></div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Agents/channels/sources are enforced at the database level (triggers). If you hit the cap, upgrade your plan.
            </p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
