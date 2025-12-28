import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getOrders, type Order } from '@/services/orders'

export default function Orders() {
  const { t, dir } = useLanguage()
  const { workspace } = useWorkspace()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }),
    []
  )

  const fetchOrders = useCallback(async () => {
    if (!workspace?.id) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getOrders(workspace.id)
      setOrders(data)
    } catch (error) {
      console.error(error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [workspace?.id])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">{dir === 'rtl' ? 'مدفوع' : 'Paid'}</Badge>
      case 'pending':
        return <Badge className="bg-amber-400 text-black hover:bg-amber-500">{dir === 'rtl' ? 'قيد الانتظار' : 'Pending'}</Badge>
      case 'cancelled':
        return <Badge variant="destructive">{dir === 'rtl' ? 'ملغي' : 'Cancelled'}</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  const renderAmount = (amount: number | null) => {
    if (amount === null || Number.isNaN(amount)) return '-'
    return currencyFormatter.format(amount / 100)
  }

  const renderTableRows = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, idx) => (
        <TableRow key={`skeleton-${idx}`}>
          {Array.from({ length: 6 }).map((__, cellIdx) => (
            <TableCell key={`cell-${idx}-${cellIdx}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))
    }

    if (orders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
            {dir === 'rtl' ? 'لا توجد طلبات بعد' : 'No orders detected yet.'}
          </TableCell>
        </TableRow>
      )
    }

    return orders.map((order) => (
      <TableRow key={order.id}>
        <TableCell className="font-medium">{order.customer_name || 'Unknown'}</TableCell>
        <TableCell>-</TableCell>
        <TableCell>
          <Badge variant="outline" className="capitalize">
            -
          </Badge>
        </TableCell>
        <TableCell>{renderAmount(order.amount)}</TableCell>
        <TableCell>{getStatusBadge(order.status)}</TableCell>
        <TableCell className="text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString()}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.orders')}</h1>
          <p className="text-muted-foreground">
            {dir === 'rtl' ? 'تتبع الطلبات الملتقطة' : 'Track captured orders'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/inbox?type=order">
            {dir === 'rtl' ? 'عرض في النشاط' : 'View in Activity'}
          </Link>
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {dir === 'rtl' ? 'جميع الطلبات' : 'All Orders'}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              <TableBody>{renderTableRows()}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
