import { apiFetch } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/utils";

export interface InstaPayPaymentRequest {
  id: string;
  workspace_id: string;
  workspace_name: string;
  plan_key: string;
  amount_egp: number;
  reference_code: string;
  user_instapay_reference: string;
  proof_url: string | null;
  created_at: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

/**
 * Fetches all pending InstaPay payment requests for admin review.
 * @returns A promise that resolves to an array of InstaPayPaymentRequest objects.
 */
export async function getPendingInstaPayRequests(): Promise<InstaPayPaymentRequest[]> {
  const authToken = await getAuthToken();
  // Assuming a static admin user ID for now, in a real app this would be from context/session
  const adminUserId = "00000000-0000-0000-0000-000000000001"; 

  const response = await apiFetch<{ pending_requests: InstaPayPaymentRequest[] }>(
    "/api/billing/instapay/pending-requests/",
    { method: "GET" },
    authToken,
    adminUserId // Pass admin user ID in header if backend expects it for RBAC
  );

  if (response.error) {
    throw new Error(response.error);
  }
  return response.data?.pending_requests || [];
}

/**
 * Confirms an InstaPay payment request.
 * @param paymentRequestId The ID of the payment request to confirm.
 * @returns A promise that resolves with a success message.
 */
export async function confirmPayment(paymentRequestId: string): Promise<string> {
  const authToken = await getAuthToken();
  // Assuming a static admin user ID for now, in a real app this would be from context/session
  const adminUserId = "00000000-0000-0000-0000-000000000001"; 

  const response = await apiFetch<{ message: string }>(
    "/api/billing/instapay/confirm-payment/",
    {
      method: "POST",
      body: JSON.stringify({ payment_request_id: paymentRequestId, admin_user_id: adminUserId }),
    },
    authToken,
    adminUserId // Pass admin user ID in header if backend expects it for RBAC
  );

  if (response.error) {
    throw new Error(response.error);
  }
  return response.data?.message || "Payment confirmed successfully.";
}

/**
 * Rejects an InstaPay payment request.
 * @param paymentRequestId The ID of the payment request to reject.
 * @returns A promise that resolves with a success message.
 */
export async function rejectPayment(paymentRequestId: string): Promise<string> {
  const authToken = await getAuthToken();
  // Assuming a static admin user ID for now, in a real app this would be from context/session
  const adminUserId = "00000000-0000-0000-0000-000000000001"; 

  const response = await apiFetch<{ message: string }>(
    "/api/billing/instapay/reject-payment/",
    {
      method: "POST",
      body: JSON.stringify({ payment_request_id: paymentRequestId, admin_user_id: adminUserId }),
    },
    authToken,
    adminUserId // Pass admin user ID in header if backend expects it for RBAC
  );

  if (response.error) {
    throw new Error(response.error);
  }
  return response.data?.message || "Payment rejected successfully.";
}