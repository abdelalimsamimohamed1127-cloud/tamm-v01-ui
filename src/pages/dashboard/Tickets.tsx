import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LifeBuoy, Loader2 } from 'lucide-react';

type Ticket = {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export default function Tickets() {
  const { dir } = useLanguage();
  const { workspace } = useWorkspace();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(200);

    setTickets((data ?? []) as any);
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  async function updateStatus(id: string, status: string) {
    await supabase.from('tickets').update({ status }).eq('id', id);
    await fetchTickets();
  }

  const statusBadge = (s: string) => {
    if (s === 'open') return <Badge variant="destructive">open</Badge>;
    if (s === 'in_progress') return <Badge variant="secondary">in_progress</Badge>;
    if (s === 'resolved') return <Badge variant="outline">resolved</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  return (
    <div className="space-y-6" dir={dir}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">{dir === 'rtl' ? 'التذاكر' : 'Tickets'}</h1>
          <p className="text-muted-foreground">
            {dir === 'rtl' ? 'الشكاوى وطلبات الدعم التي تم استخراجها تلقائيًا أو إنشاؤها يدويًا.' : 'Support tickets extracted automatically or created manually.'}
          </p>
        </div>
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            {dir === 'rtl' ? 'قائمة التذاكر' : 'Ticket list'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {dir === 'rtl' ? 'لا توجد تذاكر بعد' : 'No tickets yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dir === 'rtl' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{dir === 'rtl' ? 'الفئة' : 'Category'}</TableHead>
                  <TableHead>{dir === 'rtl' ? 'الأولوية' : 'Priority'}</TableHead>
                  <TableHead>{dir === 'rtl' ? 'ملاحظات' : 'Notes'}</TableHead>
                  <TableHead className="text-right">{dir === 'rtl' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell className="font-medium">{t.category ?? '-'}</TableCell>
                    <TableCell>{t.priority ?? '-'}</TableCell>
                    <TableCell className="max-w-[420px] truncate">{t.notes ?? '-'}</TableCell>
                    <TableCell className="text-right space-x-2 rtl:space-x-reverse">
                      <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, 'in_progress')}>
                        {dir === 'rtl' ? 'جارٍ العمل' : 'In progress'}
                      </Button>
                      <Button size="sm" onClick={() => updateStatus(t.id, 'resolved')}>
                        {dir === 'rtl' ? 'تم' : 'Resolve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
