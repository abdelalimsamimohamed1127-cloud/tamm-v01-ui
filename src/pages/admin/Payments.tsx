import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPendingInstaPayRequests,
  confirmPayment,
  rejectPayment,
  InstaPayPaymentRequest,
} from "@/services/adminPayments";

// Assuming there's an AdminLayout component. If not, this can be removed.
// import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<InstaPayPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InstaPayPaymentRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<'confirm' | 'reject' | null>(null);

  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    try {
      const requests = await getPendingInstaPayRequests();
      setPendingRequests(requests);
    } catch (error: any) {
      console.error("Failed to fetch pending InstaPay requests:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load pending payments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleAction = useCallback(async (action: 'confirm' | 'reject') => {
    if (!selectedRequest) return;

    if (action === 'confirm') {
      setIsConfirming(true);
    } else {
      setIsRejecting(true);
    }

    try {
      let message: string;
      if (action === 'confirm') {
        message = await confirmPayment(selectedRequest.id);
      } else {
        message = await rejectPayment(selectedRequest.id);
      }
      toast({
        title: "Success",
        description: message,
        variant: "success",
      });
      fetchPendingRequests(); // Refresh the list
      setDialogOpen(false);
    } catch (error: any) {
      console.error(`Failed to ${action} payment request:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} payment.`,
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
      setIsRejecting(false);
    }
  }, [selectedRequest, toast, fetchPendingRequests]);

  const openDialog = useCallback((request: InstaPayPaymentRequest, action: 'confirm' | 'reject') => {
    setSelectedRequest(request);
    setDialogAction(action);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedRequest(null);
    setDialogAction(null);
  }, []);

  // Wrap the content with a div for now, assuming AdminLayout could be integrated later
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">InstaPay Pending Payments</h1>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : pendingRequests.length === 0 ? (
        <p className="text-center text-muted-foreground">No pending InstaPay requests found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount (EGP)</TableHead>
                <TableHead>Reference Code</TableHead>
                <TableHead>User Ref</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.workspace_name}</TableCell>
                  <TableCell><Badge variant="outline">{request.plan_key}</Badge></TableCell>
                  <TableCell>{request.amount_egp.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-xs">{request.reference_code}</TableCell>
                  <TableCell>{request.user_instapay_reference}</TableCell>
                  <TableCell>{new Date(request.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {request.proof_url ? (
                      <a href={request.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center">
                        View <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => openDialog(request, 'confirm')}
                      disabled={isConfirming || isRejecting}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDialog(request, 'reject')}
                      disabled={isConfirming || isRejecting}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'confirm' ? 'Confirm Payment' : 'Reject Payment'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {dialogAction === 'confirm' ? 'confirm' : 'reject'} this payment for{" "}
              <strong>{selectedRequest?.workspace_name}</strong> ({selectedRequest?.plan_key})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {/* Optional admin note input could go here */}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isConfirming || isRejecting}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'confirm' ? 'success' : 'destructive'}
              onClick={() => handleAction(dialogAction!)}
              disabled={isConfirming || isRejecting}
            >
              {(isConfirming || isRejecting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogAction === 'confirm' ? 'Confirm' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}