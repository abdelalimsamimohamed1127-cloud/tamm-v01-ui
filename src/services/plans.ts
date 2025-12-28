import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/utils";
// import { debug } from "console"; // Removed as debug not used

export interface Plan {
  plan_key: string; // Changed from 'id' to 'plan_key' to match backend config
  name: string;
  description: string;
  price_monthly_cents: number; // For display, not for actual purchase logic in UI
  monthly_credits: number;
  features: string[]; // Changed from Record<string, any>
  is_active: boolean; // Indicates if this plan is currently active for the workspace
  current_period_end?: string; // Optional, for active plans
  is_current_in_settings?: boolean; // Indicates if this plan is the one saved in workspace_settings
  status?: 'active' | 'pending' | 'canceled' | 'expired'; // Optional, for current plan status
  provider?: string; // Added to indicate the payment provider of the current plan
}

export interface InstaPayConfig {
  handle: string;
  bank_name: string;
  account_number: string;
}

export interface InstaPayPaymentRequestResponse {
  id: string;
  workspace_id: string;
  plan_key: string;
  amount_egp: string; // 금액은 문자열로 받는 것이 안전합니다 (Decimal을 나타내기 위해)
  reference_code: string;
  status: 'pending' | 'confirmed' | 'rejected';
  instapay_handle: string;
  bank_name: string;
}


export interface PaymobCheckoutResponse {
  payment_url: string;
}

interface AllPlansApiResponse {
  plans: Plan[];
  instapay_config: InstaPayConfig;
}

/**
 * Fetches all available plans from the backend.
 * @returns A promise that resolves to an array of Plan objects and InstaPay config.
 */
export async function getAllPlans(): Promise<AllPlansApiResponse> {
  const authToken = await getAuthToken();
  const response = await apiFetch<AllPlansApiResponse>("/api/billing/plans/", { method: "GET" }, authToken);

  if (response.error) {
    throw new Error(response.error);
  }
  // Backend returns plans as an object, not directly an array.
  // Assuming the actual plans are under a 'plans' key in the response data.
  // The actual return type of `apiFetch` is `ApiResponse<T>`, so `response.data` needs
  // to be checked and possibly unwrapped if the backend wraps the array in an object.
  // For now, assuming direct array from `response.data` for simplicity.
  // Based on backend/billing/views.py: return JsonResponse({"plans": plans, "instapay_config": instapay_config})
  const allPlansData = response.data as AllPlansApiResponse;
  return allPlansData || { plans: [], instapay_config: { handle: '', bank_name: '', account_number: '' } };
}

/**
 * Fetches the current active plan for a given workspace from the backend.
 * @param workspaceId The ID of the workspace.
 * @returns A promise that resolves to a Plan object.
 */
export async function getCurrentPlan(workspaceId: string): Promise<Plan> {
  const authToken = await getAuthToken();
  const response = await apiFetch<Plan>(`/api/billing/plans/current/${workspaceId}/`, { method: "GET" }, authToken);

  if (response.error) {
    throw new Error(response.error);
  }
  // Based on backend/billing/views.py: return JsonResponse({"current_plan": current_plan})
  const currentPlanData = response.data as unknown as { current_plan: Plan };
  return currentPlanData?.current_plan;
}

/**
 * Initiates a Paymob checkout process for a plan upgrade.
 * @param workspaceId The ID of the workspace.
 * @param planKey The key of the plan to upgrade to.
 * @returns A promise that resolves to an object containing the Paymob payment URL.
 */
export async function startUpgrade(workspaceId: string, planKey: string): Promise<PaymobCheckoutResponse> {
  const authToken = await getAuthToken();
  const response = await apiFetch<PaymobCheckoutResponse>(
    "/api/billing/paymob/initiate-checkout/",
    {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId, plan_key: planKey }),
    },
    authToken,
    workspaceId // Pass workspaceId as X-Workspace-ID header
  );

  if (response.error) {
    throw new Error(response.error);
  }
  // Based on backend/billing/views.py: return JsonResponse({"payment_url": payment_url})
  const paymobResponse = response.data as PaymobCheckoutResponse;
  if (!paymobResponse?.payment_url) {
    throw new Error("Payment URL not received from backend.");
  }
  return paymobResponse;
}

/**
 * Creates an InstaPay payment request.
 * @param workspaceId The ID of the workspace.
 * @param planKey The key of the plan.
 * @param userInstapayReference The user's InstaPay transaction reference.
 * @param proofUrl Optional URL to payment proof.
 * @returns A promise that resolves to the created InstaPayPaymentRequestResponse.
 */
export async function createInstaPayPaymentRequest(
  workspaceId: string,
  planKey: string,
  userInstapayReference: string,
  proofUrl: Optional<string> = null
): Promise<InstaPayPaymentRequestResponse> {
  const authToken = await getAuthToken();
  const response = await apiFetch<InstaPayPaymentRequestResponse>(
    "/api/billing/instapay/create-request/",
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        plan_key: planKey,
        user_instapay_reference: userInstapayReference,
        proof_url: proofUrl,
      }),
    },
    authToken,
    workspaceId
  );

  if (response.error) {
    throw new Error(response.error);
  }
  const paymentRequestData = response.data as InstaPayPaymentRequestResponse;
  if (!paymentRequestData) {
    throw new Error("Failed to create InstaPay payment request.");
  }
  return paymentRequestData;
}


// These functions are no longer directly used by the UI but are kept for reference
// or if there are other parts of the system still using them for direct Supabase access.
// They might be removed if the new API endpoints fully replace their functionality.
export async function createPlan(data: any): Promise<any> {
  const { data: result, error } = await supabase.from("plans").insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updatePlan(id: string, data: Partial<any>): Promise<any> {
  const { data: result, error } = await supabase.from("plans").update(data).eq("id", id).select().single();
  if (error) throw error;
  return result;
}

export async function togglePlanActive(id: string, isActive: boolean): Promise<any> {
  const { data, error } = await supabase.from("plans").update({ is_active: isActive }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
