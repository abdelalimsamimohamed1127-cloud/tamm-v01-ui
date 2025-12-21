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
  free: { maxAgents: 1, maxChannels: 1, maxSources: 5, maxKbBytes: 10 * 1024 * 1024, maxMessagesOutPerMonth: 300, maxMessagesInPerMonth: 600 },
  paid1: { maxAgents: 1, maxChannels: 2, maxSources: 20, maxKbBytes: 50 * 1024 * 1024, maxMessagesOutPerMonth: 2000, maxMessagesInPerMonth: 4000 },
  paid2: { maxAgents: 5, maxChannels: 5, maxSources: 100, maxKbBytes: 200 * 1024 * 1024, maxMessagesOutPerMonth: 10000, maxMessagesInPerMonth: 20000 },
  paid3: { maxAgents: 20, maxChannels: 20, maxSources: 500, maxKbBytes: 1024 * 1024 * 1024, maxMessagesOutPerMonth: 100000, maxMessagesInPerMonth: 200000 },
};

export function normalizePlanTier(v?: string | null): PlanTier {
  const s = (v ?? '').toLowerCase().trim();
  if (s === 'paid1' || s === 'paid2' || s === 'paid3') return s;
  return 'free';
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B','KB','MB','GB','TB'];
  let b = Math.max(0, bytes);
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
