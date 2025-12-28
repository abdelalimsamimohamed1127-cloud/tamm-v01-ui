import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, ShoppingCart, DollarSign, Sparkles } from 'lucide-react';

interface Stats {
  conversations: number;
  orders: number;
  revenue: number;
}

export default function Overview() {
  const { t, dir } = useLanguage();
  
  const { workspace, isLoading } = useWorkspace();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  const [stats, setStats] = useState<Stats>({ conversations: 0, orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [conversationsRes, ordersRes] = await Promise.all([
        supabase
          .from('conversations')
          .select('id', { count: 'exact' })
          .eq('workspace_id', workspace.id)
          .gte('created_at', today.toISOString()),
        supabase
          .from('orders')
          .select('id, amount')
          .eq('workspace_id', workspace.id)
          .gte('created_at', today.toISOString()),
      ]);

      const revenue = (ordersRes.data || []).reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

      setStats({
        conversations: conversationsRes.count || 0,
        orders: ordersRes.data?.length || 0,
        revenue,
      });
      setLoading(false);
    }

    void fetchStats();
  }, [workspace.id]);

  const statCards = [
    {
      title: t('stats.conversations'),
      value: stats.conversations,
      icon: MessageSquare,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: t('stats.orders'),
      value: stats.orders,
      icon: ShoppingCart,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      title: t('stats.revenue'),
      value: `$${stats.revenue.toFixed(0)}`,
      icon: DollarSign,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ];

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.overview')}</h1>
        <p className="text-muted-foreground">
          {dir === 'rtl' ? 'مرحباً بعودتك!' : 'Welcome back!'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agent Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {t('stats.active')}
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              </h3>
              <p className="text-sm text-muted-foreground">
                {dir === 'rtl'
                  ? 'وكيلك الذكي جاهز للرد على العملاء'
                  : 'Your AI agent is ready to respond to customers'}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
