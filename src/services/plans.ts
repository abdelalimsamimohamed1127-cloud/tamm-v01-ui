import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  monthly_credits: number;
  features: Record<string, any>;
  is_active: boolean;
  paymob_plan_id: string | null;
  created_at: string;
}

export type PlanInput = {
  name: string;
  price_monthly: number;
  monthly_credits: number;
  features: Record<string, any>;
  paymob_plan_id?: string | null;
};

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("price_monthly", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function createPlan(data: PlanInput): Promise<Plan> {
  const { data: result, error } = await supabase
    .from("plans")
    .insert({
      name: data.name,
      price_monthly: data.price_monthly,
      monthly_credits: data.monthly_credits,
      features: data.features,
      paymob_plan_id: data.paymob_plan_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return result as Plan;
}

export async function updatePlan(
  id: string,
  data: Partial<PlanInput>
): Promise<Plan> {
  const updates: Record<string, any> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.price_monthly !== undefined) updates.price_monthly = data.price_monthly;
  if (data.monthly_credits !== undefined) updates.monthly_credits = data.monthly_credits;
  if (data.features !== undefined) updates.features = data.features;
  if (data.paymob_plan_id !== undefined) updates.paymob_plan_id = data.paymob_plan_id ?? null;

  const { data: result, error } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return result as Plan;
}

export async function togglePlanActive(
  id: string,
  isActive: boolean
): Promise<Plan> {
  const { data, error } = await supabase
    .from("plans")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Plan;
}
