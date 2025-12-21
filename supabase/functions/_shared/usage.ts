import { normalizePlanTier, PLAN_LIMITS, type PlanTier } from './plan.ts';

export function currentPeriodYYYYMM() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getWorkspacePlanTier(supabase: any, workspaceId: string): Promise<PlanTier> {
  // prefer workspace_settings.plan_tier, fallback to workspaces.plan
  const { data: wsSettings } = await supabase
    .from('workspace_settings')
    .select('plan_tier')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (wsSettings?.plan_tier) return normalizePlanTier(wsSettings.plan_tier);

  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .maybeSingle();

  return normalizePlanTier((ws as any)?.plan);
}

export async function getUsageForPeriod(supabase: any, workspaceId: string, periodYYYYMM: string) {
  const { data } = await supabase
    .from('usage_counters')
    .select('messages_in,messages_out,kb_bytes,channels_count,agents_count,sources_count')
    .eq('workspace_id', workspaceId)
    .eq('period_yyyymm', periodYYYYMM)
    .maybeSingle();
  return data ?? {
    messages_in: 0,
    messages_out: 0,
    kb_bytes: 0,
    channels_count: 0,
    agents_count: 0,
    sources_count: 0,
  };
}

export async function enforceMessageLimitsOrThrow(supabase: any, workspaceId: string) {
  const period = currentPeriodYYYYMM();
  const tier = await getWorkspacePlanTier(supabase, workspaceId);
  const limits = PLAN_LIMITS[tier];
  const usage = await getUsageForPeriod(supabase, workspaceId, period);

  if ((usage.messages_out ?? 0) >= limits.maxMessagesOutPerMonth) {
    const err: any = new Error('Plan limit reached: messages_out');
    err.code = 'PLAN_LIMIT_MESSAGES_OUT';
    err.tier = tier;
    err.limits = limits;
    err.usage = usage;
    throw err;
  }
  return { tier, limits, usage, period };
}

export async function enforceKbLimitsOrThrow(supabase: any, workspaceId: string, incomingBytes: number) {
  const period = currentPeriodYYYYMM();
  const tier = await getWorkspacePlanTier(supabase, workspaceId);
  const limits = PLAN_LIMITS[tier];
  const usage = await getUsageForPeriod(supabase, workspaceId, period);

  if ((usage.kb_bytes ?? 0) + incomingBytes > limits.maxKbBytes) {
    const err: any = new Error('Plan limit reached: kb_bytes');
    err.code = 'PLAN_LIMIT_KB_BYTES';
    err.tier = tier;
    err.limits = limits;
    err.usage = usage;
    throw err;
  }
  return { tier, limits, usage, period };
}


export async function enforceSourceLimitsOrThrow(supabase: any, workspaceId: string, incomingSources: number = 1) {
  const tier = await getWorkspacePlanTier(supabase, workspaceId);
  const limits = PLAN_LIMITS[tier];

  const { count, error } = await supabase
    .from('knowledge_sources')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) throw error;

  const current = count ?? 0;
  if (current + incomingSources > limits.maxSources) {
    const err: any = new Error('Plan limit reached: sources_count');
    err.code = 'PLAN_LIMIT_SOURCES';
    err.tier = tier;
    err.limits = limits;
    err.usage = { sources_count: current };
    throw err;
  }
}


export async function bumpUsageCounters(
  supabase: any,
  workspaceId: string,
  deltas: { in?: number; out?: number; kbBytes?: number; channelsCount?: number; agentsCount?: number; sourcesCount?: number }
) {
  const period = currentPeriodYYYYMM();
  // RPC exists and is service_role-only; edge uses admin client so OK.
  await supabase.rpc('bump_usage_counters', {
    p_workspace_id: workspaceId,
    p_period_yyyymm: period,
    p_delta_in: deltas.in ?? 0,
    p_delta_out: deltas.out ?? 0,
    p_delta_kb_bytes: deltas.kbBytes ?? 0,
    p_channels_count: deltas.channelsCount ?? null,
    p_agents_count: deltas.agentsCount ?? null,
    p_sources_count: deltas.sourcesCount ?? null,
  });
  return period;
}
