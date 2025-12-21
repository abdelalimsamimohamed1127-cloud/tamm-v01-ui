export type PlanTier = 'free' | 'paid1' | 'paid2' | 'paid3';

export const PLAN_PRICING_EGP: Record<Exclude<PlanTier, 'free'>, number> = {
  paid1: 999,
  paid2: 2999,
  paid3: 9999,
};

export function getTierPriceEgp(tier: PlanTier): number {
  if (tier === 'free') return 0;
  return PLAN_PRICING_EGP[tier];
}