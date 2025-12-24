import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceSubscription {
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  monthlyCredits: number;
  features: Record<string, any>;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    created_at: string;
  }>;
}

export async function getWorkspaceSubscription(
  workspaceId: string
): Promise<WorkspaceSubscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "status, current_period_end, plans(name, monthly_credits, features)"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const plan = (data as any).plans ?? {};

  return {
    planName: plan.name ?? "Unknown Plan",
    status: (data as any).status ?? "",
    currentPeriodEnd: (data as any).current_period_end ?? null,
    monthlyCredits: plan.monthly_credits ?? 0,
    features: plan.features ?? {},
  };
}

export async function getWalletBalance(
  workspaceId: string
): Promise<WalletBalance> {
  const { data: wallet, error: walletError } = await supabase
    .from("workspace_wallets")
    .select("balance, currency")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (walletError) {
    throw walletError;
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from("credit_transactions")
    .select("id, amount, type, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (transactionsError) {
    throw transactionsError;
  }

  return {
    balance: wallet?.balance ?? 0,
    currency: wallet?.currency ?? "CREDITS",
    recentTransactions: transactions ?? [],
  };
}
