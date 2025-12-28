import { supabase } from "@/integrations/supabase/client";

// Define types for the data structures
export type WorkspaceWallet = {
  workspace_id: string;
  balance: number;
  currency: string;
  recentTransactions: {
    id: string;
    created_at: string;
    type: string;
    amount: number;
  }[];
};

export type WorkspacePlan = {
  workspace_id: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  monthlyCredits: number;
};

/**
 * Fetches the wallet information for a given workspace.
 * @param workspace_id The ID of the workspace.
 * @returns A Promise that resolves to WorkspaceWallet or null if not found/error.
 */
export async function getWorkspaceWallet(workspace_id: string): Promise<WorkspaceWallet | null> {
  try {
    const { data, error } = await supabase
      .from("workspace_wallets")
      .select("workspace_id, balance, currency")
      .eq("workspace_id", workspace_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    // Mock recent transactions since the component needs it
    const recentTransactions = [
      { id: '1', created_at: new Date().toISOString(), type: 'usage', amount: -10 },
      { id: '2', created_at: new Date().toISOString(), type: 'topup', amount: 1000 },
    ];

    return {
      ...data,
      balance: data.balance,
      recentTransactions,
    } as WorkspaceWallet;
  } catch (error) {
    console.error(`Error fetching wallet for workspace ${workspace_id}:`, error);
    throw error;
  }
}

/**
 * Fetches the plan information for a given workspace.
 * @param workspace_id The ID of the workspace.
 * @returns A Promise that resolves to WorkspacePlan or null if not found/error.
 */
export async function getWorkspacePlan(workspace_id: string): Promise<WorkspacePlan | null> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("workspace_id, plan_key, status, current_period_end")
      .eq("workspace_id", workspace_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    // Mock plan details
    const planDetails = {
      free: { planName: 'Free', monthlyCredits: 100 },
      starter: { planName: 'Starter', monthlyCredits: 2000 },
      pro: { planName: 'Pro', monthlyCredits: 10000 },
    };

    const plan_key = data.plan_key as keyof typeof planDetails;

    return {
      ...data,
      planName: planDetails[plan_key]?.planName || 'Unknown Plan',
      monthlyCredits: planDetails[plan_key]?.monthlyCredits || 0,
      currentPeriodEnd: data.current_period_end,
    } as WorkspacePlan;
  } catch (error) {
    console.error(`Error fetching subscription for workspace ${workspace_id}:`, error);
    throw error;
  }
}