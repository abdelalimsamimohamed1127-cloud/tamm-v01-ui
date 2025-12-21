import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShoppingCart, Loader2 } from 'lucide-react';

interface Order {
  id: string;
  customer_name: string | null;
  product: string | null;
  channel: string | null;
  status: string | null;
  amount: number | null;
  created_at: string;
}

export default function Orders() {
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }, [workspace.id]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-accent text-accent-foreground">{dir === 'rtl' ? 'مؤكد' : 'Confirmed'}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{dir === 'rtl' ? 'قيد الانتظار' : 'Pending'}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{dir === 'rtl' ? 'ملغي' : 'Cancelled'}</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

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
        <h1 className="text-2xl font-bold">{t('dashboard.orders')}</h1>
        <p className="text-muted-foreground">
          {dir === 'rtl' ? 'تتبع الطلبات الملتقطة' : 'Track captured orders'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {dir === 'rtl' ? 'جميع الطلبات' : 'All Orders'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{dir === 'rtl' ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                <p className="text-sm">
                  {dir === 'rtl'
                    ? 'ستظهر الطلبات هنا عندما يكتشفها تمم'
                    : 'Orders will appear here when Tamm detects them'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dir === 'rtl' ? 'العميل' : 'Customer'}</TableHead>
                    <TableHead>{dir === 'rtl' ? 'المنتج' : 'Product'}</TableHead>
                    <TableHead>{dir === 'rtl' ? 'القناة' : 'Channel'}</TableHead>
                    <TableHead>{dir === 'rtl' ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{dir === 'rtl' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{dir === 'rtl' ? 'التاريخ' : 'Date'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.customer_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{order.product || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {order.channel || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.amount ? `$${Number(order.amount).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
