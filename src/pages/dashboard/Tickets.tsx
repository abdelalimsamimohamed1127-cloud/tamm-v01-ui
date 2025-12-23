import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LifeBuoy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getTickets, type Ticket } from '@/services/tickets'

export default function Tickets() {
  const { dir } = useLanguage()
  const { workspace } = useWorkspace()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    []
  )

  const fetchTickets = useCallback(async () => {
    if (!workspace?.id) {
      setTickets([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getTickets(workspace.id)
      setTickets(data)
    } catch (error) {
      console.error(error)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [workspace?.id])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  const statusBadge = (status: Ticket['status']) => {
    if (status === 'new') return <Badge variant="destructive">New</Badge>
    if (status === 'in_progress') return <Badge variant="secondary">In progress</Badge>
    return <Badge variant="outline">Closed</Badge>
  }

  const priorityBadge = (priority: Ticket['priority']) => {
    if (priority === 'high') return <Badge variant="destructive">High</Badge>
    if (priority === 'medium') return <Badge variant="secondary">Medium</Badge>
    return <Badge variant="outline">Low</Badge>
  }

  const renderRows = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, idx) => (
        <TableRow key={`skeleton-${idx}`}>
          {Array.from({ length: 5 }).map((__, cellIdx) => (
            <TableCell key={`cell-${idx}-${cellIdx}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))
    }

    if (tickets.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
            {dir === 'rtl' ? 'لا توجد تذاكر بعد' : 'No tickets yet'}
          </TableCell>
        </TableRow>
      )
    }

    return tickets.map((ticket) => (
      <TableRow key={ticket.id} className="cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
        <TableCell className="font-mono text-sm text-muted-foreground">{ticket.id.slice(0, 6)}</TableCell>
        <TableCell className="font-medium">{ticket.subject || '-'}</TableCell>
        <TableCell>{priorityBadge(ticket.priority)}</TableCell>
        <TableCell>{statusBadge(ticket.status)}</TableCell>
        <TableCell className="text-muted-foreground">{dateFormatter.format(new Date(ticket.created_at))}</TableCell>
      </TableRow>
    ))
  }

  return (
    <div className="space-y-6" dir={dir}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dir === 'rtl' ? 'التذاكر' : 'Tickets'}</h1>
          <p className="text-muted-foreground">
            {dir === 'rtl'
              ? 'الشكاوى وطلبات الدعم التي تم استخراجها تلقائيًا أو إنشاؤها يدويًا.'
              : 'Support tickets extracted automatically or created manually.'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/inbox?type=ticket">{dir === 'rtl' ? 'عرض في النشاط' : 'View in Activity'}</Link>
        </Button>
      </motion.div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            {dir === 'rtl' ? 'قائمة التذاكر' : 'Ticket list'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dir === 'rtl' ? 'المعرف' : 'ID'}</TableHead>
                <TableHead>{dir === 'rtl' ? 'الموضوع' : 'Subject'}</TableHead>
                <TableHead>{dir === 'rtl' ? 'الأولوية' : 'Priority'}</TableHead>
                <TableHead>{dir === 'rtl' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{dir === 'rtl' ? 'تاريخ الإنشاء' : 'Created At'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows()}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={selectedTicket !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTicket(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject || 'Ticket details'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Priority:</span>
              {selectedTicket ? priorityBadge(selectedTicket.priority) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Status:</span>
              {selectedTicket ? statusBadge(selectedTicket.status) : null}
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Description</p>
              <p>{selectedTicket?.description || 'No description provided.'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
