export type PlanTier = 'free' | 'paid1' | 'paid2' | 'paid3';

export type PlanLimits = {
  maxAgents: number;
  maxChannels: number;
  maxSources: number;
  maxKbBytes: number;
  maxMessagesOutPerMonth: number;
  maxMessagesInPerMonth: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxAgents: 1,
    maxChannels: 1,
    maxSources: 5,
    maxKbBytes: 10 * 1024 * 1024, // 10 MB
    maxMessagesOutPerMonth: 1000,
    maxMessagesInPerMonth: 2000,
  },
  paid1: {
    maxAgents: 2,
    maxChannels: 2,
    maxSources: 20,
    maxKbBytes: 50 * 1024 * 1024, // 50 MB
    maxMessagesOutPerMonth: 5000,
    maxMessagesInPerMonth: 10000,
  },
  paid2: {
    maxAgents: 5,
    maxChannels: 5,
    maxSources: 100,
    maxKbBytes: 200 * 1024 * 1024, // 200 MB
    maxMessagesOutPerMonth: 20000,
    maxMessagesInPerMonth: 40000,
  },
  paid3: {
    maxAgents: 20,
    maxChannels: 20,
    maxSources: 500,
    maxKbBytes: 1024 * 1024 * 1024, // 1 GB
    maxMessagesOutPerMonth: 100000,
    maxMessagesInPerMonth: 200000,
  },
};

export function normalizePlanTier(v?: string | null): PlanTier {
  const s = (v ?? '').toLowerCase().trim();
  if (s === 'paid1' || s === 'paid2' || s === 'paid3') return s;
  return 'free';
}
