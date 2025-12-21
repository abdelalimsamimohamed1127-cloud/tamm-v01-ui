import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type InsightReport = {
  id: string;
  created_at: string;
  period_yyyymm: string | null;
  title: string | null;
  report: any;
};

export default function Insights() {
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<InsightReport[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('insight_reports')
      .select('id,created_at,period_yyyymm,title,report')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setReports((data as any) ?? []);
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateNow() {
    setLoading(true);
    await supabase.functions.invoke('generate_weekly_insights', {
      body: { workspace_id: workspace.id },
    });
    await load();
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.insights')}</h1>
          <p className="text-muted-foreground">
            {dir === 'rtl' ? 'تقارير ذكية تساعدك تحسن المبيعات والدعم' : 'Weekly insights to improve sales and support'}
          </p>
        </div>
        <Button onClick={() => void generateNow()} disabled={loading}>
          {dir === 'rtl' ? 'توليد تقرير الآن' : 'Generate now'}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>{dir === 'rtl' ? 'جار التحميل...' : 'Loading...'}</CardTitle>
          </CardHeader>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{dir === 'rtl' ? 'لا توجد تقارير بعد' : 'No reports yet'}</CardTitle>
            <CardDescription>
              {dir === 'rtl'
                ? 'اضغط "توليد تقرير الآن" أو استخدم المنصة لعدة أيام.'
                : 'Click "Generate now" or use the platform for a few days.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{r.title ?? (dir === 'rtl' ? 'تقرير' : 'Report')}</CardTitle>
                <CardDescription>{new Date(r.created_at).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-3 rounded-md overflow-auto">
{JSON.stringify(r.report ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
